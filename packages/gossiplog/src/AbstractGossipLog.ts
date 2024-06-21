import { TypedEventEmitter, CustomEvent } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { equals, toString } from "uint8arrays"

import { Node, Tree, ReadWriteTransaction, hashEntry } from "@canvas-js/okra"
import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelsInit, Effect } from "@canvas-js/modeldb"
import { ed25519 } from "@canvas-js/signatures"
import { assert, zip } from "@canvas-js/utils"

import { Driver } from "./sync/driver.js"

import type { SyncServer } from "./interface.js"
import { AncestorIndex } from "./AncestorIndex.js"
import { BranchIndex } from "./BranchIndex.js"
import { BranchMergeEntry, BranchMergeIndex } from "./BranchMergeIndex.js"
import { SignedMessage } from "./SignedMessage.js"
import { decodeId, encodeId, messageIdPattern } from "./ids.js"
import { getNextClock } from "./schema.js"
import { topicPattern } from "./utils.js"

export type GossipLogConsumer<Payload = unknown> = (
	this: AbstractGossipLog<Payload>,
	{ id, signature, message }: SignedMessage<Payload>,
) => Awaitable<void>

export interface GossipLogInit<Payload = unknown> {
	topic: string
	apply: GossipLogConsumer<Payload>
	validatePayload?: (payload: unknown) => payload is Payload
	verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	signer?: Signer<Payload>
	indexAncestors?: boolean
	rebuildMerkleIndex?: boolean
}

export type GossipLogEvents<Payload = unknown> = {
	message: CustomEvent<{ id: string; signature: Signature; message: Message<Payload> }>
	commit: CustomEvent<{ root: Node }>
	sync: CustomEvent<{ peerId?: string; duration: number; messageCount: number }>
	error: CustomEvent<{ error: Error }>
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
		...BranchIndex.schema,
		...BranchMergeIndex.schema,
		...AncestorIndex.schema,
	} satisfies ModelsInit

	public readonly topic: string
	public readonly indexAncestors: boolean
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
		this.indexAncestors = init.indexAncestors ?? false
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
				const record = await this.db.get<{ signature: Signature; message: Message<Payload> }>("$messages", id)

				if (record === null) {
					this.log.error("failed to get message %s from database", id)
					continue
				}

				const signedMessage = this.encode(record.signature, record.message)
				assert(signedMessage.id === id)
				await this.#apply.apply(this, [signedMessage])
			}
		})
	}

	public encode(signature: Signature, message: Message<Payload>): SignedMessage<Payload> {
		assert(this.topic === message.topic, "expected this.topic === topic")
		assert(this.validatePayload(message.payload), "error encoding message (invalid payload)")
		return SignedMessage.encode(signature, message)
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

	/**
	 * Sign and append a new *unsigned* message to the end of the log.
	 * The concurrent heads of the local log are used as parents.
	 */
	public async append(payload: Payload, options: { signer?: Signer<Payload> } = {}): Promise<SignedMessage<Payload>> {
		const signer = options.signer ?? this.signer

		let root: Node | null = null
		const signedMessage = await this.tree.write(async (txn) => {
			const [clock, parents] = await this.getClock()

			const message: Message<Payload> = { topic: this.topic, clock, parents, payload }
			const signature = await signer.sign(message)

			const signedMessage = this.encode(signature, message)

			this.log("appending message %s", signedMessage.id)

			await this.apply(txn, signedMessage)
			root = txn.getRoot()
			return signedMessage
		})

		assert(root !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
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
		this.log("inserting message %s", signedMessage.id)

		await this.verifySignature(signedMessage.signature, signedMessage.message)
		const parentKeys = signedMessage.message.parents.map(encodeId)

		let root: Node | null = null
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

			await this.apply(txn, signedMessage)
			root = txn.getRoot()
		})

		assert(root !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))

		return { id: signedMessage.id }
	}

	private async apply(txn: ReadWriteTransaction, signedMessage: SignedMessage<Payload>): Promise<void> {
		this.log("applying %s %O", signedMessage.id, signedMessage.message)

		try {
			await this.#apply.apply(this, [signedMessage])
		} catch (error) {
			this.dispatchEvent(new CustomEvent("error", { detail: { error } }))
			throw error
		}

		const { id, signature, message, key, value } = signedMessage

		const hash = toString(hashEntry(key, value), "hex")

		const branch = await this.getBranch(id, message.clock, message.parents)
		const clock = message.clock

		const branchMergeIndex = new BranchMergeIndex(this.db)
		for (const parentId of message.parents) {
			const parentMessageResult = await this.db.get("$messages", parentId)
			if (!parentMessageResult) {
				throw new Error(`missing parent ${parentId} of message ${id}`)
			}
			const parentBranch = parentMessageResult.branch
			const parentClock = parentMessageResult.message.clock
			if (parentBranch !== branch) {
				await branchMergeIndex.insertBranchMerge({
					source_branch: parentBranch,
					source_clock: parentClock,
					source_message_id: parentId,
					target_branch: branch,
					target_clock: message.clock,
					target_message_id: id,
				})
			}
		}

		await this.db.set("$messages", { id, signature, message, hash, branch, clock })

		const heads = await this.db.query<{ id: string }>("$heads")
		await this.db.apply([
			...heads
				.filter((head) => message.parents.includes(head.id))
				.map<Effect>((head) => ({ model: "$heads", operation: "delete", key: head.id })),
			{ model: "$heads", operation: "set", value: { id } },
		])

		txn.set(key, value)

		// const root = await txn.getRoot()
		// await new MerkleIndex(this.db).commit(root)

		await new AncestorIndex(this.db).indexAncestors(id, message.parents)

		this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message } }))
	}

	private async getBranch(messageId: string, clock: number, parentIds: string[]) {
		if (parentIds.length == 0) {
			return await new BranchIndex(this.db).createNewBranch()
		}

		// const parentBranches: number[] = []
		let maxBranch = -1
		let parentMessageWithMaxClock: any = null
		for (const parentId of parentIds) {
			const parentMessage = await this.db.get("$messages", parentId)
			if (parentMessage == null) {
				throw new Error(`Parent message ${parentId} not found`)
			}
			if (parentMessage.branch > maxBranch) {
				parentMessageWithMaxClock = parentMessage
				maxBranch = parentMessage.branch
			}
		}
		const branch = maxBranch

		const messagesAtBranchClockPosition = await this.db.query("$messages", {
			where: {
				branch,
				clock: {
					gt: parentMessageWithMaxClock.clock,
				},
				id: { neq: messageId },
			},
		})

		if (messagesAtBranchClockPosition.length > 0) {
			return await new BranchIndex(this.db).createNewBranch()
		} else {
			return branch
		}
	}

	public async getAncestors(id: string, atOrBefore: number): Promise<string[]> {
		const results = await new AncestorIndex(this.db).getAncestors(id, atOrBefore)
		this.log("getAncestors of %s atOrBefore %d: %o", id, atOrBefore, results)
		return Array.from(results).sort()
	}

	public async isAncestor(id: string, ancestor: string, visited = new Set<string>()): Promise<boolean> {
		const ancestorMessage = await this.db.get("$messages", ancestor)
		if (!ancestorMessage) {
			throw new Error(`Message ${ancestor} not found`)
		}

		const toVisit: string[] = []
		toVisit.push(id)

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const currentMessageId = toVisit.pop()
			if (!currentMessageId) {
				break
			}
			visited.add(currentMessageId)

			// visit
			const getCurrentMessageResult = await this.db.get("$messages", currentMessageId)
			if (!getCurrentMessageResult) {
				throw new Error(`Message ${currentMessageId} not found`)
			}

			if (
				getCurrentMessageResult.branch == ancestorMessage.branch &&
				getCurrentMessageResult.clock >= ancestorMessage.clock
			) {
				// found the message
				return true
			}

			// this message has a lower clock or branch value than the ancestor message
			// so none of its parents will be children of the ancestor
			if (
				getCurrentMessageResult.clock < ancestorMessage.clock ||
				getCurrentMessageResult.branch < ancestorMessage.branch
			) {
				continue
			}

			// get parents
			const branchMerges = await this.db.query<BranchMergeEntry>("$branch_merges", {
				where: {
					target_branch: getCurrentMessageResult.branch,
					target_clock: {
						lte: getCurrentMessageResult.clock,
					},
				},
			})
			for (const branchMerge of branchMerges) {
				toVisit.push(branchMerge.source_message_id)
			}
		}
		return false
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
