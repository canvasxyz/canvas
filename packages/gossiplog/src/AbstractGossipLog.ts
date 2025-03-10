import { TypedEventEmitter, Libp2p } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { equals, toString } from "uint8arrays"

import { Node, Tree, ReadWriteTransaction, hashEntry } from "@canvas-js/okra"
import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelSchema, Effect, DatabaseUpgradeAPI, Config } from "@canvas-js/modeldb"
import { ed25519 } from "@canvas-js/signatures"
import { assert, zip, prepare, prepareMessage } from "@canvas-js/utils"

import type { NetworkClient } from "@canvas-js/gossiplog"
import type { NetworkConfig, ServiceMap } from "@canvas-js/gossiplog/libp2p"
import { AbortError, MessageNotFoundError, MissingParentError } from "@canvas-js/gossiplog/errors"
import * as sync from "@canvas-js/gossiplog/sync"

import target from "#target"

import type { SyncSnapshot } from "./interface.js"
import { AncestorIndex } from "./AncestorIndex.js"
import { BranchMergeIndex } from "./BranchMergeIndex.js"
import { MessageSource, SignedMessage } from "./SignedMessage.js"
import { decodeId, encodeId, messageIdPattern, MessageId } from "./MessageId.js"
import { getNextClock } from "./schema.js"
import { gossiplogTopicPattern } from "./utils.js"

export type GossipLogConsumer<Payload = unknown, Result = any> = (
	this: AbstractGossipLog<Payload, Result>,
	signedMessage: SignedMessage<Payload, Result>,
) => Awaitable<Result>

export interface GossipLogInit<Payload = unknown, Result = any> {
	topic: string
	apply: GossipLogConsumer<Payload, Result>
	signer?: Signer<Payload>

	/** validate that the IPLD `payload` is a `Payload` type */
	validatePayload?: (payload: unknown) => payload is Payload
	verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	/** add extra tables to the local database for private use */
	schema?: ModelSchema
	version?: Record<string, number>
	upgrade?: (
		upgradeAPI: DatabaseUpgradeAPI,
		oldConfig: Config,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) => Awaitable<void>
	initialUpgradeSchema?: ModelSchema
	initialUpgradeVersion?: Record<string, number>
}

export type GossipLogEvents<Payload = unknown, Result = any> = {
	message: CustomEvent<SignedMessage<Payload>>
	commit: CustomEvent<{ root: Node; heads: string[] }>
	sync: CustomEvent<{ duration: number; messageCount: number; peer?: string }>
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
}

export type MessageRecord<Payload> = {
	id: string
	signature: Signature
	message: Message<Payload>
	hash: string
	branch: number
	clock: number
}

export abstract class AbstractGossipLog<Payload = unknown, Result = any> extends TypedEventEmitter<
	GossipLogEvents<Payload, Result>
> {
	public static namespace = "gossiplog"
	public static version = 1

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

	protected static baseVersion = { [AbstractGossipLog.namespace]: AbstractGossipLog.version }

	protected static async upgrade(
		upgradeAPI: DatabaseUpgradeAPI,
		oldConfig: Config,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) {
		const version = oldVersion[AbstractGossipLog.namespace] ?? 0
		if (version < AbstractGossipLog.version) {
			// GossipLog migrations go here
			throw new Error("unexpected GossipLog version")
		}
	}

	public readonly topic: string
	public readonly signer: Signer<Payload>
	public readonly controller = new AbortController()

	public abstract db: AbstractModelDB
	public abstract tree: Tree

	protected readonly log: Logger

	public readonly validatePayload: (payload: unknown) => payload is Payload
	public readonly verifySignature: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	readonly #apply: GossipLogConsumer<Payload, Result>

	protected constructor(init: GossipLogInit<Payload, Result>) {
		super()
		assert(
			gossiplogTopicPattern.test(init.topic),
			"invalid topic (must be of the form 'topic' or 'topic#hash', where topic matches [a-zA-Z0-9\\.\\-])",
		)

		this.topic = init.topic
		this.signer = init.signer ?? ed25519.create()

		this.#apply = init.apply
		this.validatePayload = init.validatePayload ?? ((payload: unknown): payload is Payload => true)
		this.verifySignature = init.verifySignature ?? this.signer.scheme.verify

		this.log = logger(`canvas:gossiplog:[${this.topic}]`)
	}

	public async close() {
		this.log("closing")
		this.controller.abort()
		await this.tree.close()
		await this.db.close()
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

				const { signature, message, branch } = record
				const signedMessage = this.encode(signature, message, { branch })
				assert(signedMessage.id === id)
				await this.#apply.apply(this, [signedMessage])
			}
		})
	}

	public async connect(url: string, options: { signal?: AbortSignal } = {}): Promise<NetworkClient<any>> {
		return await target.connect(this, url, options)
	}

	public async listen(port: number, options: { signal?: AbortSignal } = {}): Promise<void> {
		await target.listen(this, port, options)
	}

	public async startLibp2p(config: NetworkConfig): Promise<Libp2p<ServiceMap<Payload>>> {
		const libp2p = await target.startLibp2p(this, config)

		this.controller.signal.addEventListener("abort", () => libp2p.stop())

		return libp2p
	}

	public encode<T extends Payload = Payload>(
		signature: Signature,
		message: Message<T>,
		context: { source?: MessageSource; branch?: number } = {},
	): SignedMessage<T, Result> {
		if (this.topic !== message.topic) {
			this.log.error("invalid message: %O", message)
			throw new Error(`cannot encode message: expected topic ${this.topic}, found topic ${message.topic}`)
		}

		const preparedMessage = prepareMessage(message)
		if (!this.validatePayload(preparedMessage.payload)) {
			this.log.error("invalid message: %O", message)
			throw new Error(`error encoding message: invalid payload`)
		}

		return SignedMessage.encode(signature, preparedMessage, context)
	}

	public decode(
		value: Uint8Array,
		context: { source?: MessageSource; branch?: number } = {},
	): SignedMessage<Payload, Result> {
		const signedMessage = SignedMessage.decode<Payload, Result>(value, context)
		const { topic, payload } = signedMessage.message
		if (this.topic !== topic) {
			this.log.error("invalid message: %O", signedMessage.message)
			throw new Error(`cannot decode message: expected topic ${this.topic}, found topic ${topic}`)
		}

		if (!this.validatePayload(payload)) {
			this.log.error("invalid message: %O", signedMessage.message)
			throw new Error(`error decoding message: invalid payload`)
		}

		return signedMessage
	}

	public async getClock(): Promise<[clock: number, heads: string[]]> {
		const heads = await this.db.getAll<{ id: string }>("$heads")
		const ids = heads.map(({ id }) => id)
		const clock = getNextClock(ids.map(encodeId))
		return [clock, ids]
	}

	public async has(id: string): Promise<boolean> {
		assert(messageIdPattern.test(id), "invalid message ID")
		const records = await this.db.query<{ id: string }>("$messages", { select: { id: true }, where: { id } })
		return records.length > 0
	}

	public async get(id: string): Promise<SignedMessage<Payload, Result> | null> {
		const record = await this.db.get<MessageRecord<Payload>>("$messages", id)
		if (record === null) {
			return null
		}

		const { signature, message, branch } = record
		return this.encode(signature, message, { branch })
	}

	public async getMessages(
		range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {},
	): Promise<{ id: string; signature: Signature; message: Message<Payload>; branch: number }[]> {
		const { reverse = false, limit, ...where } = range
		return await this.db.query<{ id: string; signature: Signature; message: Message<Payload>; branch: number }>(
			"$messages",
			{
				where: { id: where },
				select: { id: true, signature: true, message: true, branch: true },
				orderBy: { id: reverse ? "desc" : "asc" },
				limit,
			},
		)
	}

	public async *iterate(
		range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {},
	): AsyncIterable<SignedMessage<Payload, Result>> {
		const { reverse = false, limit, ...where } = range
		for await (const row of this.db.iterate<{ id: string; signature: Signature; message: Message<Payload> }>(
			"$messages",
			{
				where: { id: where },
				select: { id: true, signature: true, message: true },
				orderBy: { id: reverse ? "desc" : "asc" },
				limit,
			},
		)) {
			yield this.encode(row.signature, row.message)
		}
	}

	/**
	 * Sign and append a new *unsigned* message to the end of the log.
	 * The current concurrent heads of the local log are used as parents.
	 */
	public async append<T extends Payload = Payload>(
		payload: T,
		{ signer = this.signer }: { signer?: Signer<Payload> } = {},
	): Promise<SignedMessage<T, Result> & { result: Result }> {
		let root: Node | null = null
		let heads: string[] | null = null
		let result: Result | undefined = undefined

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

			const applyResult = await this.apply(txn, signedMessage)

			root = applyResult.root
			heads = applyResult.heads
			result = applyResult.result

			return signedMessage
		})

		assert(root !== null && heads !== null, "failed to commit transaction")
		this.dispatchEvent(new CustomEvent("commit", { detail: { root, heads } }))

		signedMessage.result = result
		return signedMessage as SignedMessage<T, Result> & { result: Result }
	}

	/**
	 * Insert an existing signed message into the log (ie received via HTTP API).
	 * If any of the parents are not present, throw an error.
	 */
	public async insert(signedMessage: SignedMessage<Payload, Result>): Promise<{ id: string }> {
		const { message, signature } = signedMessage

		assert(message.topic === this.topic, `expected message.topic === this.topic`)

		await this.verifySignature(signature, message)

		const { clock, parents } = signedMessage.message

		const id = signedMessage.id

		this.log("inserting message %s at clock %d with parents %o", id, clock, parents)

		const result = await this.tree.write(async (txn) => {
			if (txn.has(signedMessage.key)) {
				return null
			}

			return await this.apply(txn, signedMessage)
		})

		if (result !== null) {
			this.dispatchEvent(new CustomEvent("commit", { detail: result }))
		}

		return { id }
	}

	private async apply(
		txn: ReadWriteTransaction,
		signedMessage: SignedMessage<Payload>,
	): Promise<{ root: Node; heads: string[]; result: Result }> {
		const { id, signature, message, key, value } = signedMessage
		this.log.trace("applying %s %O", id, message)

		const parentMessageRecords: MessageRecord<Payload>[] = []
		for (const parent of message.parents) {
			const parentMessageRecord = await this.db.get<MessageRecord<Payload>>("$messages", parent)
			if (parentMessageRecord === null) {
				this.log.error("missing parent %s of message %s: %O", parent, id, message)
				throw new MissingParentError(parent, id)
			}

			parentMessageRecords.push(parentMessageRecord)
		}

		const branch = await this.getBranch(id, parentMessageRecords)
		signedMessage.branch = branch
		const result = await this.#apply.apply(this, [signedMessage])

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
			.getAll<{ id: string }>("$heads")
			.then((heads) => heads.filter((head) => message.parents.includes(head.id)))
			.then((heads) => heads.map((head) => head.id))

		await this.db.apply([
			...heads.map<Effect>((head) => ({ model: "$heads", operation: "delete", key: head })),
			{ model: "$heads", operation: "set", value: { id } },
			{ model: "$messages", operation: "set", value: messageRecord },
		])

		txn.set(key, value)

		await new AncestorIndex(this.db).indexAncestors(id, message.parents)

		this.dispatchEvent(new CustomEvent("message", { detail: signedMessage }))

		const root = txn.getRoot()
		return { root, heads, result }
	}

	private async newBranch() {
		const maxBranchRecords = await this.db.query("$messages", {
			select: { id: true, branch: true },
			limit: 1,
			orderBy: { branch: "desc" },
		})

		if (maxBranchRecords.length === 0) {
			return 0
		} else {
			return maxBranchRecords[0].branch + 1
		}
	}

	private async getBranch(messageId: string, parentMessages: MessageRecord<Payload>[]) {
		if (parentMessages.length === 0) {
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

	public async isAncestor(
		root: string | string[] | MessageId | MessageId[],
		ancestor: string | MessageId,
	): Promise<boolean> {
		const ids = Array.isArray(root) ? root : [root]
		const visited = new Set<string>()
		const ancestorIndex = new AncestorIndex(this.db)
		for (const id of ids) {
			const isAncestor = await ancestorIndex.isAncestor(id, ancestor, visited)
			if (isAncestor) {
				return true
			}
		}

		return false
	}

	/**
	 * Sync with a remote source, applying and inserting all missing messages into the local log
	 */
	public async sync(
		snapshot: SyncSnapshot,
		options: { peer?: string } = {},
	): Promise<{ complete: boolean; messageCount: number }> {
		const start = performance.now()
		let messageCount = 0

		let complete = true

		const root = await this.tree.read(async (txn) => {
			const driver = new sync.Driver(this.topic, snapshot, txn)
			try {
				for await (const keys of driver.sync()) {
					const values = await snapshot.getValues(keys)

					for (const [key, value] of zip(keys, values)) {
						const signedMessage = this.decode(value, {
							source: options.peer === undefined ? undefined : { type: "sync", peer: options.peer },
						})

						assert(equals(key, signedMessage.key), "invalid message key")
						await this.insert(signedMessage)
						messageCount++
					}
				}
			} catch (err) {
				if (err instanceof AbortError) {
					complete = false
				} else {
					throw err
				}
			}

			return txn.getRoot()
		})

		const duration = Math.ceil(performance.now() - start)
		if (complete) {
			this.log("completed sync with %s (%d messages in %dms)", options.peer ?? "unknown", messageCount, duration)
		} else {
			this.log("aborted sync with %s (%d messages in %dms)", options.peer ?? "unknown", messageCount, duration)
		}

		this.dispatchEvent(new CustomEvent("sync", { detail: { peer: options.peer, messageCount, duration } }))

		return { complete, messageCount }
	}

	public serve<T>(callback: (snapshot: SyncSnapshot) => Awaitable<T>): Promise<T> {
		return this.tree.read((txn) =>
			callback({
				getRoot: () => txn.getRoot(),
				getNode: (level, key) => txn.getNode(level, key),
				getChildren: (level, key) => txn.getChildren(level, key),
				getValues: async (keys) => {
					const values: Uint8Array[] = []
					const ids = keys.map(decodeId)

					const messageRecords = await this.db.getMany<MessageRecord<Payload>>("$messages", ids)

					for (let i = 0; i < messageRecords.length; i++) {
						const messageRecord = messageRecords[i]
						if (messageRecord === null) {
							throw new MessageNotFoundError(ids[i])
						}

						const { signature, message, branch } = messageRecord
						const signedMessage = this.encode(signature, message, { branch })

						assert(equals(signedMessage.key, keys[i]), "invalid message key")
						values.push(signedMessage.value)
					}

					return values
				},
			}),
		)
	}
}
