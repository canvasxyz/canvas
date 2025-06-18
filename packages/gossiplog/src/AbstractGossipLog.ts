import { TypedEventEmitter, Libp2p } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { equals, toString } from "uint8arrays"

import { Node, Tree, ReadWriteTransaction, hashEntry } from "@canvas-js/okra"
import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import type {
	AbstractModelDB,
	ModelSchema,
	Effect,
	DatabaseUpgradeAPI,
	Config,
	RangeExpression,
} from "@canvas-js/modeldb"
import { ed25519, prepareMessage } from "@canvas-js/signatures"
import { assert, zip } from "@canvas-js/utils"

import { NetworkClient } from "@canvas-js/gossiplog/client"
import { NetworkConfig, ServiceMap } from "@canvas-js/gossiplog/libp2p"
import { AbortError, MessageNotFoundError, MissingParentError } from "@canvas-js/gossiplog/errors"
import * as sync from "@canvas-js/gossiplog/sync"

import target from "#target"
import { namespace, version } from "#migrations"

import { SyncSnapshot } from "./interface.js"
import { AncestorIndex } from "./AncestorIndex.js"
import { MessageSet } from "./MessageSet.js"
import { MessageId, decodeId, messageIdPattern } from "./MessageId.js"
import { MessageSource, SignedMessage, getNextClock } from "./SignedMessage.js"
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
	) => Promise<boolean>
	initialUpgradeSchema?: ModelSchema
	initialUpgradeVersion?: Record<string, number>
	clear?: boolean
}

export type GossipLogEvents<Payload = unknown, Result = any> = {
	message: CustomEvent<SignedMessage<Payload, Result>>
	commit: CustomEvent<{ root: Node; heads: string[] }>
	sync: CustomEvent<{ duration: number; messageCount: number; complete: boolean; peer?: string }>
	"sync:status": CustomEvent<{ status: "complete" | "incomplete"; role: "client" | "server"; peer?: string }>
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
	error: CustomEvent<{ error: Error; peer: string }>
}

export type MessageRecord = {
	id: string
	data: Uint8Array
	hash: string
	clock: number
}

export type ReplayRecord = {
	timestamp: string
	cursor: string | null
}

export abstract class AbstractGossipLog<Payload = unknown, Result = any> extends TypedEventEmitter<
	GossipLogEvents<Payload, Result>
> {
	public static namespace = namespace
	public static version = version

	public static schema = {
		$messages: {
			id: "primary",
			data: "bytes",
			hash: "string",
			clock: "integer",
			$indexes: ["clock"],
		},
		$heads: { id: "primary" },
		$replays: {
			timestamp: "primary",
			cursor: "string?",
			$indexes: ["cursor"],
		},
		...AncestorIndex.schema,
	} satisfies ModelSchema

	public readonly topic: string
	public readonly signer: Signer<Payload>
	public readonly controller = new AbortController()

	protected readonly log: Logger
	protected readonly ancestorIndex: AncestorIndex

	public readonly validatePayload: (payload: unknown) => payload is Payload
	public readonly verifySignature: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	#apply: GossipLogConsumer<Payload, Result>

	protected constructor(
		public readonly db: AbstractModelDB,
		public readonly tree: Tree,
		init: GossipLogInit<Payload, Result>,
	) {
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
		this.ancestorIndex = new AncestorIndex(db)
	}

	protected async initialize() {
		const replays = await this.db.query<ReplayRecord>("$replays", {
			where: { cursor: { neq: null } },
			orderBy: { timestamp: "desc" },
		})

		if (replays.length > 0) {
			const [{ timestamp, cursor }, ...rest] = replays
			assert(cursor !== null, "internal error - expected cursor !== null")

			this.log("found incomplete replay from %s at cursor %s", timestamp, cursor)

			// clear existing replay records
			await this.db.apply(
				rest.map<Effect>(({ timestamp }) => ({
					model: "$replays",
					operation: "set",
					value: { timestamp, cursor: null },
				})),
			)

			await this.#replay(timestamp, cursor)
		}
	}

	public async close() {
		this.log("closing")
		this.controller.abort()
		await new Promise((resolve) => setTimeout(resolve, 0))
		await this.tree.close()
		await this.db.close()
	}

	public async replay(): Promise<boolean> {
		this.log("beginning replay")

		// clear existing replay records
		await this.db.query<ReplayRecord>("$replays", { where: { cursor: { neq: null } } }).then(async (replays) => {
			const effects = replays.map<Effect>((replay) => ({
				model: "$replays",
				operation: "set",
				value: { ...replay, cursor: null },
			}))

			await this.db.apply(effects)
		})

		const timestamp = new Date().toISOString()
		await this.db.set("$replays", { timestamp, cursor: null })

		for (const name of ["$heads", ...Object.keys(AncestorIndex.schema)]) {
			this.log("clearing model %s", name)
			await this.db.clear(name)
		}

		await this.tree.clear()
		return await this.#replay(timestamp)
	}

	async #replay(timestamp: string, cursor?: string) {
		const pageSize = 128

		const lowerBound: RangeExpression = { gt: cursor }
		while (!this.controller.signal.aborted) {
			this.log("fetching new page")
			const results = await this.db.query<MessageRecord>("$messages", {
				orderBy: { id: "asc" },
				where: { id: lowerBound },
				limit: pageSize,
			})

			this.log("got new page of %d records", results.length)

			if (results.length === 0) {
				this.log("finished replaying")
				await this.db.set("$replays", { timestamp, cursor: null })
				return true
			}

			let [{ id: cursor }] = results
			await this.tree.write(async (txn) => {
				for (const { id, data } of results) {
					this.log("replaying message %s", id)
					const signedMessage = this.decode(data)
					assert(signedMessage.id === id, "internal error - expected signedMessage.id === id")
					await this.apply(txn, signedMessage)
					cursor = id
					if (this.controller.signal.aborted) {
						break
					}
				}
			})

			lowerBound.gt = cursor
			await this.db.set("$replays", { timestamp, cursor })
		}

		this.log("replay incomplete")
		return false
	}

	public setConsumer(apply: GossipLogConsumer<Payload, Result>) {
		this.#apply = apply
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
		context: { source?: MessageSource } = {},
	): SignedMessage<T, Result> {
		if (this.topic !== message.topic) {
			this.log.error("invalid message: %O", message)
			throw new Error(`cannot encode message: expected topic ${this.topic}, found topic ${message.topic}`)
		}

		const preparedMessage = prepareMessage(message)

		if (!this.validatePayload(preparedMessage.payload)) {
			this.log.error("invalid message: %O", preparedMessage)
			throw new Error(`error encoding message: invalid payload`)
		}

		return SignedMessage.encode(signature, preparedMessage, context)
	}

	public decode(value: Uint8Array, context: { source?: MessageSource } = {}): SignedMessage<Payload, Result> {
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

	public async getHeads(): Promise<MessageSet> {
		const heads = await this.db.getAll<{ id: string }>("$heads")
		return new MessageSet(heads.map((head) => MessageId.encode(head.id)))
	}

	public async getClock(): Promise<[clock: number, heads: string[]]> {
		const heads = await this.db.getAll<{ id: string }>("$heads")
		const ids = heads.map(({ id }) => id)
		const clock = getNextClock(ids)
		return [clock, ids]
	}

	public async has(id: string): Promise<boolean> {
		assert(messageIdPattern.test(id), "invalid message ID")
		const records = await this.db.query<{ id: string }>("$messages", { select: { id: true }, where: { id } })
		return records.length > 0
	}

	public async get(id: string): Promise<SignedMessage<Payload, Result> | null> {
		const record = await this.db.get<MessageRecord>("$messages", id)
		if (record === null) {
			return null
		} else {
			return this.decode(record.data)
		}
	}

	public async getMessages(
		range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {},
	): Promise<SignedMessage<Payload>[]> {
		const { reverse = false, limit, ...where } = range
		const records = await this.db.query<{ id: string; data: Uint8Array }>("$messages", {
			where: { id: where },
			select: { id: true, data: true },
			orderBy: { id: reverse ? "desc" : "asc" },
			limit,
		})

		return records.map(({ data }) => this.decode(data))
	}

	public async *iterate(
		range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {},
	): AsyncIterable<SignedMessage<Payload, Result>> {
		const { reverse = false, limit, ...where } = range
		for await (const row of this.db.iterate<{ id: string; data: Uint8Array }>("$messages", {
			where: { id: where },
			select: { id: true, data: true },
			orderBy: { id: reverse ? "desc" : "asc" },
			limit,
		})) {
			yield this.decode(row.data)
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

			const message = prepareMessage<T>({ topic: this.topic, clock, parents, payload })
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

		const messageId = new MessageId(id, key, message.clock)
		const parentIds = new MessageSet(message.parents.map(MessageId.encode))

		for (const parentId of parentIds) {
			if (!txn.has(parentId.key)) {
				throw new MissingParentError(parentId.id, id)
			}
		}

		const result = await this.#apply.apply(this, [signedMessage])

		const hash = toString(hashEntry(key, value), "hex")

		const messageRecord: MessageRecord = { id, data: signedMessage.value, hash, clock: message.clock }

		const effects: Effect[] = [
			{ model: "$heads", operation: "set", value: { id } },
			{ model: "$messages", operation: "set", value: messageRecord },
		]

		const newHeads = [id]
		const oldHeads = await this.db.getAll<{ id: string }>("$heads")
		for (const head of oldHeads) {
			if (message.parents.includes(head.id)) {
				effects.push({ model: "$heads", operation: "delete", key: head.id })
			} else {
				newHeads.push(head.id)
			}
		}

		newHeads.sort()

		await this.ancestorIndex.indexAncestors(messageId, parentIds, effects)
		await this.db.apply(effects)
		txn.set(key, value)

		this.dispatchEvent(new CustomEvent("message", { detail: signedMessage }))

		const root = txn.getRoot()
		return { root, heads: newHeads, result }
	}

	public async isAncestor(
		root: string | string[] | MessageId | MessageId[] | MessageSet,
		ancestor: string | MessageId,
	): Promise<boolean> {
		const visited = new MessageSet()
		const ids = root instanceof MessageSet ? root : Array.isArray(root) ? root : [root]
		const ancestorId = typeof ancestor === "string" ? MessageId.encode(ancestor) : ancestor
		for (const id of ids) {
			const rootId = typeof id === "string" ? MessageId.encode(id) : id
			this.log.trace("isAncestor %s ?-> %s", rootId.clock, rootId.id, ancestorId.clock, ancestorId.id)
			const isAncestor = await this.ancestorIndex.isAncestor(rootId, ancestorId, visited)
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
		let source: MessageSource | undefined = undefined
		if (options.peer !== undefined) {
			source = { type: "sync", peer: options.peer }
		}

		let executionDuration = 0

		await this.tree.read(async (txn) => {
			const driver = new sync.Driver(this.topic, snapshot, txn)
			try {
				for await (const keys of driver.sync()) {
					const values = await snapshot.getValues(keys)

					for (const [key, value] of zip(keys, values)) {
						const signedMessage = this.decode(value, { source })
						assert(equals(key, signedMessage.key), "invalid message key")
						const executionStart = performance.now()
						await this.insert(signedMessage)
						executionDuration += performance.now() - executionStart
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
		})

		const duration = Math.ceil(performance.now() - start)
		const peer = options.peer ?? "unknown"
		if (complete) {
			this.log("completed sync with %s (%dms total)", peer, duration)
		} else {
			this.log("aborted sync with %s (%dms total)", peer, duration)
		}

		this.log("applied %d messages in %dms", messageCount, Math.ceil(executionDuration))

		this.dispatchEvent(new CustomEvent("sync", { detail: { peer: options.peer, messageCount, complete, duration } }))

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

					const messageRecords = await this.db.getMany<MessageRecord>("$messages", ids)

					for (let i = 0; i < messageRecords.length; i++) {
						const messageRecord = messageRecords[i]
						if (messageRecord === null) {
							throw new MessageNotFoundError(ids[i])
						}

						values.push(messageRecord.data)
					}

					return values
				},
			}),
		)
	}
}
