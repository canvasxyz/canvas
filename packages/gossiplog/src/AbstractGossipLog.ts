import { TypedEventEmitter, CustomEvent } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { equals, toString } from "uint8arrays"

import { Node, Tree, ReadWriteTransaction, hashEntry, ReadOnlyTransaction } from "@canvas-js/okra"
import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelSchema, Effect } from "@canvas-js/modeldb"
import { ed25519 } from "@canvas-js/signatures"
import { assert, zip, prepare, prepareMessage } from "@canvas-js/utils"

import { Driver } from "./sync/driver.js"

import type { SyncServer } from "./interface.js"
import { BranchMergeRecord, BranchMergeIndex } from "./BranchMergeIndex.js"
import { SignedMessage } from "./SignedMessage.js"
import { decodeId, encodeId, messageIdPattern } from "./ids.js"
import { getNextClock } from "./schema.js"
import { topicPattern } from "./utils.js"
import { AncestorIndex } from "./AncestorIndex.js"

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
	rebuildMerkleIndex?: boolean
}

export type GossipLogEvents<Payload = unknown> = {
	message: CustomEvent<{ id: string; signature: Signature; message: Message<Payload> }>
	commit: CustomEvent<{ root: Node; heads: string[] }>
	sync: CustomEvent<{ peerId?: string; duration: number; messageCount: number }>
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

	public async replay() {
		await this.tree.read(async (txn) => {
			for (const leaf of txn.keys()) {
				const id = decodeId(leaf)
				const record = await this.db.get<{ signature: Signature; message: Message<Payload>; branch: number }>(
					"$messages",
					id,
				)

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

	public encode<T extends Payload = Payload>(
		signature: Signature,
		message: Message<T>,
		{ replaceUndefined }: { replaceUndefined: boolean } = { replaceUndefined: true },
	): SignedMessage<T> {
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
		const record = await this.db.get<{ signature: Signature; message: Message<Payload> }>("$messages", id)
		if (record === null) {
			return [null, null]
		} else {
			return [record.signature, record.message]
		}
	}

	public export(
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
			yield row;
		}
	}

	/**
	 * Sign and append a new *unsigned* message to the end of the log.
	 * The concurrent heads of the local log are used as parents.
	 */
	public async append<T extends Payload = Payload>(
		payload: T,
		options: { signer?: Signer<Payload> } = {},
	): Promise<SignedMessage<T>> {
		const signer = options.signer ?? this.signer

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

		assert(root !== null, "failed to commit transaction")
		assert(heads !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root, heads } }))
		return signedMessage
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

	/**
	 * Insert an existing signed message into the log (ie received via HTTP API).
	 * If any of the parents are not present, throw an error.
	 */
	public async insert(signedMessage: SignedMessage<Payload>): Promise<{ id: string }> {
		const { clock, parents } = signedMessage.message
		this.log("inserting message %s at clock %d with parents %o", signedMessage.id, clock, parents)

		await this.verifySignature(signedMessage.signature, signedMessage.message)
		const parentKeys = signedMessage.message.parents.map(encodeId)

		let root: Node | null = null
		let heads: string[] | null = null
		await this.tree.write(async (txn) => {
			const hasSignedMessage = await this.has(signedMessage.id)
			if (hasSignedMessage) {
				return
			}

			for (const parentKey of parentKeys) {
				const leaf = txn.getNode(0, parentKey)
				if (leaf === null) {
					this.log.error("missing parent %s of message %s: %O", parent, signedMessage.id, signedMessage.message)
					throw new Error(`missing parent ${parent} of message ${signedMessage.id}`)
				}
			}

			const result = await this.apply(txn, signedMessage)
			root = result.root
			heads = result.heads
		})

		assert(root !== null, "failed to commit transaction")
		assert(heads !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root, heads } }))

		return { id: signedMessage.id }
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

		await this.db.set("$messages", { id, signature, message, hash, branch, clock: message.clock })

		const heads: { id: string }[] = await this.db
			.query<{ id: string }>("$heads")
			.then((heads) => heads.filter((head) => message.parents.includes(head.id)))

		await this.db.apply([
			...heads.map<Effect>((head) => ({ model: "$heads", operation: "delete", key: head.id })),
			{ model: "$heads", operation: "set", value: { id } },
		])

		txn.set(key, value)

		await new AncestorIndex(this.db).indexAncestors(id, message.parents)

		this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message } }))

		const root = txn.getRoot()
		return { root, heads: heads.map((head) => head.id) }
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

		const messagesAtBranchClockPosition = await this.db.query<MessageRecord<Payload>>("$messages", {
			select: { id: true, branch: true, clock: true },
			where: {
				branch,
				clock: {
					gt: parentMessageWithMaxClock.clock,
				},
				id: { neq: messageId },
			},
			limit: 1,
		})

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
	public async sync(server: SyncServer, options: { sourceId?: string } = {}): Promise<{ messageCount: number }> {
		const start = performance.now()
		let messageCount = 0

		await this.tree.read(async (txn) => {
			const driver = new Driver(this.topic, server, txn)
			for await (const keys of driver.sync()) {
				const values = await server.getValues(keys)

				for (const [key, value] of zip(keys, values)) {
					const signedMessage = this.decode(value)
					assert(equals(key, signedMessage.key), "invalid message key")
					await this.verifySignature(signedMessage.signature, signedMessage.message)

					await this.insert(signedMessage)
					messageCount++
				}
			}
		})

		const duration = Math.ceil(performance.now() - start)
		this.log("finished sync with peer %s (%d messages in %dms)", options.sourceId, messageCount, duration)
		this.dispatchEvent(new CustomEvent("sync", { detail: { peerId: options.sourceId, messageCount, duration } }))
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

					for (const key of keys) {
						const [signature, message] = await this.get(decodeId(key))
						if (signature === null || message === null) {
							throw new Error("wtf??")
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
