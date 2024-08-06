import { TypedEventEmitter, CustomEvent, CodeError, Libp2p, PeerId } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { equals, toString } from "uint8arrays"

import { Node, Tree, ReadWriteTransaction, hashEntry } from "@canvas-js/okra"
import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelSchema, Effect } from "@canvas-js/modeldb"
import { ed25519 } from "@canvas-js/signatures"
import { assert, zip, prepare, prepareMessage } from "@canvas-js/utils"

import { Driver } from "./sync/driver.js"

import type { ServiceMap, SyncServer } from "./interface.js"
import { AncestorIndex } from "./AncestorIndex.js"
import { BranchMergeIndex } from "./BranchMergeIndex.js"
import { SignedMessage } from "./SignedMessage.js"
import { decodeId, encodeId, messageIdPattern } from "./ids.js"
import { getNextClock } from "./schema.js"
import { MISSING_PARENT, topicPattern } from "./utils.js"

import { GossipLogService } from "./GossipLogService.js"

export type GossipLogConsumer<Payload = unknown> = (
	this: AbstractGossipLog<Payload>,
	{ id, signature, message }: SignedMessage<Payload>,
	branch: number,
) => Awaitable<void>

export interface GossipLogInit<Payload = unknown> {
	topic: string
	apply: GossipLogConsumer<Payload>
	validatePayload?: (payload: unknown) => payload is Payload
	verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	signer?: Signer<Payload>
	schema?: ModelSchema
}

export type GossipLogEvents<Payload = unknown> = {
	message: CustomEvent<{ id: string; signature: Signature; message: Message<Payload> }>
	commit: CustomEvent<{ root: Node; heads: string[] }>
	sync: CustomEvent<{ duration: number; messageCount: number; peerId?: string }>
	error: CustomEvent<{ error: Error }>
}

export type MessageRecord<Payload> = {
	id: string
	signature: Signature
	message: Message<Payload>
	hash: string
	branch: number
	clock: number
}

export abstract class AbstractGossipLog<Payload = unknown> extends TypedEventEmitter<GossipLogEvents<Payload>> {
	public static schema = {
		$messages: {
			id: "primary",
			signature: "json",
			message: "json",
			hash: "string",
			branch: "integer",
			clock: "integer",
			$indexes: ["branch", "clock"],
		},
		$heads: { id: "primary" },
		...AncestorIndex.schema,
		...BranchMergeIndex.schema,
	} satisfies ModelSchema

	public readonly topic: string
	public readonly signer: Signer<Payload>

	public abstract db: AbstractModelDB
	public abstract tree: Tree
	public abstract close(): Promise<void>

	public libp2p: Libp2p<ServiceMap> | null = null
	public service: GossipLogService<Payload> | null = null

	protected readonly log: Logger

	public readonly validatePayload: (payload: unknown) => payload is Payload
	public readonly verifySignature: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	readonly #apply: GossipLogConsumer<Payload>

	protected constructor(init: GossipLogInit<Payload>) {
		super()
		assert(topicPattern.test(init.topic), "invalid topic (must match [a-zA-Z0-9\\.\\-])")

		this.topic = init.topic
		this.signer = init.signer ?? ed25519.create()

		this.#apply = init.apply
		this.validatePayload = init.validatePayload ?? ((payload: unknown): payload is Payload => true)
		this.verifySignature = init.verifySignature ?? this.signer.scheme.verify

		this.log = logger(`canvas:gossiplog:[${this.topic}]`)
	}

	public async listen(libp2p: Libp2p<ServiceMap>) {
		assert(libp2p.status === "started")
		assert(this.libp2p === null)
		assert(this.service === null)

		this.libp2p = libp2p
		this.service = new GossipLogService(libp2p, this, {})
		await this.service.start()
	}

	public async replay() {
		await this.tree.read(async (txn) => {
			for (const leaf of txn.keys()) {
				const id = decodeId(leaf)
				const record = await this.db.get<MessageRecord<Payload>>("$messages", id)

				if (record === null) {
					this.log.error("failed to get message %s from database", id)
					continue
				}

				const signedMessage = this.encode(record.signature, record.message)
				assert(signedMessage.id === id)
				await this.#apply.apply(this, [signedMessage, record.branch])
			}
		})
	}

	public encode<T extends Payload = Payload>(signature: Signature, message: Message<T>): SignedMessage<T> {
		assert(this.topic === message.topic, "expected this.topic === topic")
		const preparedMessage = prepareMessage(message)
		assert(this.validatePayload(preparedMessage.payload), "error encoding message (invalid payload)")
		return SignedMessage.encode(signature, preparedMessage)
	}

	public decode(value: Uint8Array): SignedMessage<Payload> {
		const signedMessage = SignedMessage.decode<Payload>(value)
		assert(this.topic === signedMessage.message.topic, "expected this.topic === topic")
		assert(this.validatePayload(signedMessage.message.payload), "error decoding message (invalid payload)")
		return signedMessage
	}

	public async getClock(): Promise<[clock: number, heads: string[]]> {
		const heads = await this.db.query<{ id: string }>("$heads", { orderBy: { id: "asc" } })
		const ids = heads.map(({ id }) => id)
		const clock = getNextClock(ids.map(encodeId))
		return [clock, ids]
	}

	public async has(id: string): Promise<boolean> {
		assert(messageIdPattern.test(id), "invalid message ID")
		const records = await this.db.query<{ id: string }>("$messages", { select: { id: true }, where: { id } })
		return records.length > 0
	}

	public async get(id: string): Promise<[signature: Signature, message: Message<Payload>] | [null, null]> {
		const record = await this.db.get<MessageRecord<Payload>>("$messages", id)
		if (record === null) {
			return [null, null]
		} else {
			return [record.signature, record.message]
		}
	}

	public getMessages(
		range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {},
	): Promise<{ id: string; signature: Signature; message: Message<Payload> }[]> {
		const { reverse = false, limit, ...where } = range
		return this.db.query<{ id: string; signature: Signature; message: Message<Payload> }>("$messages", {
			where: { id: where },
			select: { id: true, signature: true, message: true },
			orderBy: { id: reverse ? "desc" : "asc" },
			limit,
		})
	}

	public async *iterate(
		range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {},
	): AsyncIterable<{ id: string; signature: Signature; message: Message<Payload> }> {
		const { reverse = false, limit, ...where } = range
		// TODO: use this.db.iterate()
		const query = await this.db.query<{ id: string; signature: Signature; message: Message<Payload> }>("$messages", {
			where: { id: where },
			select: { id: true, signature: true, message: true },
			orderBy: { id: reverse ? "desc" : "asc" },
			limit,
		})
		for await (const row of query) {
			yield row
		}
	}

	/**
	 * Sign and append a new *unsigned* message to the end of the log.
	 * The concurrent heads of the local log are used as parents.
	 */
	public async append<T extends Payload = Payload>(
		payload: T,
		{ signer = this.signer, publish = true }: { signer?: Signer<Payload>; publish?: boolean } = {},
	): Promise<{ id: string; signature: Signature; message: Message<T>; recipients: Promise<PeerId[]> }> {
		let root: Node | null = null
		let heads: string[] | null = null
		const signedMessage = await this.tree.write(async (txn) => {
			const [clock, parents] = await this.getClock()

			const message: Message<T> = {
				topic: this.topic,
				clock,
				parents,
				payload: prepare(payload, { replaceUndefined: true }),
			}

			const signature = await signer.sign(message)

			const signedMessage = this.encode(signature, message)
			this.log("appending message %s at clock %d with parents %o", signedMessage.id, clock, parents)

			const result = await this.apply(txn, signedMessage)

			root = result.root
			heads = result.heads

			return signedMessage
		})

		assert(root !== null && heads !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root, heads } }))

		if (publish && this.service !== null) {
			return {
				id: signedMessage.id,
				signature: signedMessage.signature,
				message: signedMessage.message,
				recipients: this.service.publish(signedMessage),
			}
		} else {
			return {
				id: signedMessage.id,
				signature: signedMessage.signature,
				message: signedMessage.message,
				recipients: Promise.resolve([]),
			}
		}
	}

	/**
	 * Insert an existing signed message into the log (ie received via HTTP API).
	 * If any of the parents are not present, throw an error.
	 */
	public async insert(
		signedMessage: { signature: Signature; message: Message<Payload> },
		{ publish = true, ...options }: { peerId?: string; publish?: boolean } = {},
	): Promise<{ id: string; recipients: Promise<PeerId[]> }> {
		const { message, signature } = signedMessage

		assert(message.topic === this.topic, `expected message.topic === this.topic`)

		await this.verifySignature(signature, message)

		const { clock, parents } = signedMessage.message

		const signedMessageInstance =
			signedMessage instanceof SignedMessage ? signedMessage : this.encode(signature, message)

		const id = signedMessageInstance.id

		this.log("inserting message %s at clock %d with parents %o", id, clock, parents)

		const parentKeys = message.parents.map(encodeId)

		let root: Node | null = null
		let heads: string[] | null = null
		await this.tree.write(async (txn) => {
			const hasSignedMessage = await this.has(id)
			if (hasSignedMessage) {
				return
			}

			for (const parentKey of parentKeys) {
				const leaf = txn.getNode(0, parentKey)
				if (leaf === null) {
					this.log.error("missing parent %s of message %s: %O", parent, id, message)
					throw new CodeError(`missing parent ${parent} of message ${id}`, MISSING_PARENT)
				}
			}

			const result = await this.apply(txn, signedMessageInstance)
			root = result.root
			heads = result.heads
		})

		assert(root !== null && heads !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root, heads } }))

		if (publish && this.service !== null) {
			const recipients = this.service.publish(signedMessageInstance)
			return { id, recipients }
		} else {
			return { id, recipients: Promise.resolve([]) }
		}
	}

	public getMissingParents(txn: ReadWriteTransaction, parents: string[]): Set<string> {
		const missingParents = new Set<string>()
		this.log("looking up %s parents", parents.length)
		for (const parentId of parents) {
			// TODO: txn.messages.getMany
			const leaf = txn.getNode(0, encodeId(parentId))
			if (leaf !== null) {
				this.log("found parent %s", parentId)
			} else {
				this.log("missing parent %s", parentId)
				missingParents.add(parentId)
			}
		}

		return missingParents
	}

	private async apply(
		txn: ReadWriteTransaction,
		signedMessage: SignedMessage<Payload>,
	): Promise<{ root: Node; heads: string[] }> {
		const { id, signature, message, key, value } = signedMessage
		this.log("applying %s %O", id, message)

		const parentMessageRecords: MessageRecord<Payload>[] = []
		for (const parentId of message.parents) {
			const parentMessageRecord = await this.db.get<MessageRecord<Payload>>("$messages", parentId)
			if (parentMessageRecord === null) {
				throw new Error(`missing parent ${parentId} of message ${id}`)
			}
			parentMessageRecords.push(parentMessageRecord)
		}

		const branch = await this.getBranch(id, parentMessageRecords)

		try {
			await this.#apply.apply(this, [signedMessage, branch])
		} catch (error) {
			this.dispatchEvent(new CustomEvent("error", { detail: { error } }))
			throw error
		}

		const hash = toString(hashEntry(key, value), "hex")

		const branchMergeIndex = new BranchMergeIndex(this.db)
		for (const parentMessageRecord of parentMessageRecords) {
			if (parentMessageRecord.branch !== branch) {
				await branchMergeIndex.insertBranchMerge({
					source_branch: parentMessageRecord.branch,
					source_clock: parentMessageRecord.clock,
					source_message_id: parentMessageRecord.id,
					target_branch: branch,
					target_clock: message.clock,
					target_message_id: id,
				})
			}
		}

		const messageRecord: MessageRecord<Payload> = { id, signature, message, hash, branch, clock: message.clock }

		const heads: string[] = await this.db
			.query<{ id: string }>("$heads", { select: { id: true } })
			.then((heads) => heads.map((head) => head.id))
			.then((heads) => heads.filter((head) => message.parents.includes(head)))

		await this.db.apply([
			...heads.map<Effect>((head) => ({ model: "$heads", operation: "delete", key: head })),
			{ model: "$heads", operation: "set", value: { id } },
			{ model: "$messages", operation: "set", value: messageRecord },
		])

		txn.set(key, value)

		await new AncestorIndex(this.db).indexAncestors(id, message.parents)

		this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message } }))

		const root = txn.getRoot()
		return { root, heads }
	}

	private async newBranch() {
		const maxBranchRecords = await this.db.query("$messages", {
			select: { id: true, branch: true },
			limit: 1,
			orderBy: { branch: "desc" },
		})

		if (maxBranchRecords.length == 0) {
			return 0
		} else {
			return maxBranchRecords[0].branch + 1
		}
	}

	private async getBranch(messageId: string, parentMessages: MessageRecord<Payload>[]) {
		if (parentMessages.length == 0) {
			return await this.newBranch()
		}

		const parentMessageWithMaxClock = parentMessages.reduce((max, parentMessage) =>
			max.branch > parentMessage.branch ? max : parentMessage,
		)
		const branch = parentMessageWithMaxClock.branch

		const messagesAtBranchClockPosition = await this.db.query<{ id: string; branch: number; clock: number }>(
			"$messages",
			{
				select: { id: true, branch: true, clock: true },
				where: {
					branch,
					clock: { gt: parentMessageWithMaxClock.clock },
					id: { neq: messageId },
				},
				limit: 1,
			},
		)

		if (messagesAtBranchClockPosition.length > 0) {
			return await this.newBranch()
		} else {
			return branch
		}
	}

	public async isAncestor(id: string, ancestor: string, visited = new Set<string>()): Promise<boolean> {
		return await new AncestorIndex(this.db).isAncestor(id, ancestor, visited)
	}

	/**
	 * Sync with a remote source, applying and inserting all missing messages into the local log
	 */
	public async sync(
		server: SyncServer,
		callback: (signedMessage: SignedMessage<Payload>) => Awaitable<void> = async (signedMessage) => {
			await this.insert(signedMessage)
		},
		options: { peerId?: string } = {},
	): Promise<{ messageCount: number }> {
		const start = performance.now()
		let messageCount = 0

		await this.tree.read(async (txn) => {
			const driver = new Driver(this.topic, server, txn)
			for await (const keys of driver.sync()) {
				const values = await server.getValues(keys)

				for (const [key, value] of zip(keys, values)) {
					const signedMessage = this.decode(value)
					assert(equals(key, signedMessage.key), "invalid message key")
					await callback(signedMessage)
					messageCount++
				}
			}
		})

		const duration = Math.ceil(performance.now() - start)
		this.log("finished sync with peer %s (%d messages in %dms)", options.peerId, messageCount, duration)
		this.dispatchEvent(new CustomEvent("sync", { detail: { peerId: options.peerId, messageCount, duration } }))
		return { messageCount }
	}

	public serve<T>(callback: (txn: SyncServer) => Awaitable<T>): Promise<T> {
		return this.tree.read((txn) =>
			callback({
				getRoot: () => txn.getRoot(),
				getNode: (level, key) => txn.getNode(level, key),
				getChildren: (level, key) => txn.getChildren(level, key),
				getValues: async (keys) => {
					const values: Uint8Array[] = []

					// TODO: txn.getMany
					for (const key of keys) {
						const id = decodeId(key)
						const [signature, message] = await this.get(id)
						if (signature === null || message === null) {
							throw new CodeError("message not found", "NOT_FOUND", { id })
						}

						const signedMessage = SignedMessage.encode(signature, message)
						assert(equals(signedMessage.key, key), "invalid message key")
						values.push(signedMessage.value)
					}

					return values
				},
			}),
		)
	}
}
