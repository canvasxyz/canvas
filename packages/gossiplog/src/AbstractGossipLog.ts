import type { Source, Target, Node, Bound, KeyValueStore, Entry } from "@canvas-js/okra"

import { TypedEventEmitter, CustomEvent } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"

import { bytesToHex as hex } from "@noble/hashes/utils"

import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { Mempool } from "./Mempool.js"
import { Driver } from "./sync/driver.js"

import {
	decodeId,
	encodeId,
	encodeSignedMessage,
	getNextClock,
	messageIdPattern,
	MIN_MESSAGE_ID,
	MAX_MESSAGE_ID,
	decodeSignedMessage,
} from "./schema.js"
import { topicPattern, DelayableController } from "./utils.js"

export interface ReadOnlyTransaction {
	getHeads: () => Awaitable<Uint8Array[]>
	getAncestors: (key: Uint8Array, atOrBefore: number, results: Set<string>) => Awaitable<void>
	isAncestor: (key: Uint8Array, ancestorKey: Uint8Array, visited?: Set<string>) => Awaitable<boolean>

	messages: Target
}

export interface ReadWriteTransaction extends ReadOnlyTransaction {
	insert: (id: string, signature: Signature, message: Message, entry?: Entry) => Awaitable<void>
}

export type GossipLogConsumer<Payload = unknown> = (
	id: string,
	signature: Signature,
	message: Message<Payload>,
) => Awaitable<void>

export interface GossipLogInit<Payload = unknown> {
	topic: string
	apply: GossipLogConsumer<Payload>
	validatePayload?: (payload: unknown) => payload is Payload
	verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	signer?: Pick<Signer<Payload>, "sign" | "verify">
	indexAncestors?: boolean
}

export type GossipLogEvents<Payload = unknown> = {
	message: CustomEvent<{ id: string; signature: Signature; message: Message<Payload> }>
	commit: CustomEvent<{ root: Node }>
	sync: CustomEvent<{ peer?: string; duration: number; messageCount: number }>
	error: CustomEvent<{ error: Error }>
}

export abstract class AbstractGossipLog<Payload = unknown> extends TypedEventEmitter<GossipLogEvents<Payload>> {
	public abstract close(): Promise<void>

	protected abstract entries(
		lowerBound?: Bound<Uint8Array> | null,
		upperBound?: Bound<Uint8Array> | null,
		options?: { reverse?: boolean },
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]>

	protected abstract read<T>(
		callback: (txn: ReadOnlyTransaction) => Awaitable<T>,
		options?: { targetId?: string },
	): Promise<T>

	protected abstract write<T>(
		callback: (txn: ReadWriteTransaction) => Awaitable<T>,
		options?: { sourceId?: string },
	): Promise<T>

	public readonly topic: string
	public readonly indexAncestors: boolean
	public readonly signer: Pick<Signer<Payload>, "sign" | "verify">

	protected readonly log: Logger
	protected readonly mempool = new Mempool<{ signature: Signature; message: Message<Payload> }>()

	readonly #validatePayload: (payload: unknown) => payload is Payload
	readonly #verifySignature: (signature: Signature, message: Message<Payload>) => Awaitable<void>
	readonly #apply: GossipLogConsumer<Payload>

	protected constructor(init: GossipLogInit<Payload>) {
		super()
		assert(topicPattern.test(init.topic), "invalid topic (must match [a-zA-Z0-9\\.\\-])")

		this.topic = init.topic
		this.indexAncestors = init.indexAncestors ?? false
		this.signer = init.signer ?? new Ed25519DelegateSigner<Payload>()

		this.#apply = init.apply
		this.#validatePayload = init.validatePayload ?? ((payload: unknown): payload is Payload => true)
		this.#verifySignature = init.verifySignature ?? this.signer.verify

		this.log = logger(`canvas:gossiplog:[${this.topic}]`)
	}

	public async replay() {
		await this.read(async (txn) => {
			for await (const leaf of txn.messages.nodes(0, { key: null, inclusive: false })) {
				assert(leaf.key !== null, "expected leaf.key !== null")
				assert(leaf.value !== undefined, "expected leaf.value !== undefined")

				const [id, signature, message] = this.decode(leaf.value)
				assert(id === decodeId(leaf.key), "expected id === decodeId(key)")
				await this.#apply.apply(txn, [id, signature, message])
			}
		})
	}

	public async *iterate(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[id: string, signature: Signature, message: Message<Payload>]> {
		const { id: lowerId, inclusive: lowerInclusive } = lowerBound ?? { id: MIN_MESSAGE_ID, inclusive: true }
		const { id: upperId, inclusive: upperInclusive } = upperBound ?? { id: MAX_MESSAGE_ID, inclusive: true }
		assert(messageIdPattern.test(lowerId), "lowerBound.id: invalid message ID")
		assert(messageIdPattern.test(upperId), "upperBound.id: invalid message ID")

		for await (const [key, value] of this.entries(
			{ key: encodeId(lowerId), inclusive: lowerInclusive },
			{ key: encodeId(upperId), inclusive: upperInclusive },
			options,
		)) {
			const [id, signature, message] = this.decode(value)
			assert(id === decodeId(key), "expected id === decodeId(key)")
			yield [id, signature, message]
		}
	}

	public encode(signature: Signature, message: Message<Payload>): [key: Uint8Array, value: Uint8Array] {
		assert(this.topic === message.topic, "expected this.topic === topic")
		assert(this.#validatePayload(message.payload), "error encoding message (invalid payload)")
		return encodeSignedMessage(signature, message)
	}

	public decode(value: Uint8Array): [id: string, signature: Signature, message: Message<Payload>] {
		const [id, signature, { topic, clock, parents, payload }] = decodeSignedMessage(value)
		assert(this.topic === topic, "expected this.topic === topic")
		assert(this.#validatePayload(payload), "error decoding message (invalid payload)")
		return [id, signature, { topic, clock, parents, payload }]
	}

	public async getClock(): Promise<[clock: number, heads: string[]]> {
		const heads = await this.read((txn) => txn.getHeads())
		const clock = getNextClock(heads)
		return [clock, heads.map(decodeId)]
	}

	public async has(id: string): Promise<boolean> {
		assert(messageIdPattern.test(id), "invalid message ID")
		const leaf = await this.read((txn) => txn.messages.getNode(0, encodeId(id)))
		return leaf !== null
	}

	public async get(id: string): Promise<[signature: Signature, message: Message<Payload>] | [null, null]> {
		assert(messageIdPattern.test(id), "invalid message ID")
		const leaf = await this.read((txn) => txn.messages.getNode(0, encodeId(id)))
		if (leaf === null) {
			return [null, null]
		}

		assert(leaf.value !== undefined, "expected leaf.value !== undefined")

		const [recoveredId, signature, message] = decodeSignedMessage(leaf.value)
		assert(recoveredId === id, "expected recoveredId === id")

		return [signature, message as Message<Payload>]
	}

	/**
	 * Sign and append a new *unsigned* message to the end of the log.
	 * The currently unmerged heads of the local log are used as parents.
	 */
	public async append(
		payload: Payload,
		options: { signer?: Pick<Signer<Payload>, "sign" | "verify"> } = {},
	): Promise<{ id: string; signature: Signature; message: Message<Payload> }> {
		const signer = options.signer ?? this.signer

		const { id, signature, message, root } = await this.write(async (txn) => {
			const heads = await txn.getHeads()

			const clock = getNextClock(heads)

			const parents = heads.map(decodeId)
			const message: Message<Payload> = { topic: this.topic, clock, parents, payload }
			const signature = await signer.sign(message)
			const [key, value] = this.encode(signature, message)

			const id = decodeId(key)
			this.log("appending message %s: %O", id, message)
			const { root } = await this.#insert(txn, id, signature, message, [key, value])
			return { id, signature, message, root }
		})

		this.dispatchEvent(new CustomEvent("commit", { detail: { topic: this.topic, root } }))
		this.log("commited root %s", hex(root.hash))

		return { id, signature, message }
	}

	/**
	 * Insert an existing signed message into the log (ie received via PubSub).
	 * If any of the parents are not present, insert the message into the mempool instead.
	 */
	public async insert(signature: Signature, message: Message<Payload>): Promise<{ id: string }> {
		await this.#verifySignature(signature, message)

		const { id, root } = await this.write(async (txn) => {
			const [key, value] = this.encode(signature, message)
			const id = decodeId(key)

			this.log("inserting message %s", id)

			const missingParents = new Set<string>()
			this.log("looking up %s parents", message.parents.length)
			for (const parentId of message.parents) {
				// TODO: txn.messages.getMany
				const leaf = await txn.messages.getNode(0, encodeId(parentId))
				if (leaf !== null) {
					this.log("found parent %s", parentId)
				} else {
					this.log("missing parent %s", parentId)
					missingParents.add(parentId)
				}
			}

			if (missingParents.size > 0) {
				this.log("missing %d/%d parents", missingParents.size, message.parents.length)
				this.mempool.add(id, { signature, message }, missingParents)
				return { id }
			}

			const { root } = await this.#insert(txn, id, signature, message, [key, value])

			return { id, root }
		})

		if (root !== undefined) {
			this.dispatchEvent(new CustomEvent("commit", { detail: { topic: this.topic, root } }))
			this.log("commited root %s", hex(root.hash))
		}

		return { id }
	}

	public async getAncestors(id: string, atOrBefore: number): Promise<string[]> {
		assert(messageIdPattern.test(id), "invalid message ID")

		const results = new Set<string>()
		await this.read((txn) => txn.getAncestors(encodeId(id), atOrBefore, results))

		this.log("getAncestors of %s atOrBefore %d: %o", id, atOrBefore, results)
		return Array.from(results).sort()
	}

	public async isAncestor(id: string, ancestor: string): Promise<boolean> {
		assert(messageIdPattern.test(id), "invalid message ID")
		assert(messageIdPattern.test(ancestor), "invalid message ID")
		return await this.read((txn) => txn.isAncestor(encodeId(id), encodeId(ancestor)))
	}

	async #insert(
		txn: ReadWriteTransaction,
		id: string,
		signature: Signature,
		message: Message<Payload>,
		[key, value]: Entry = this.encode(signature, message),
	): Promise<{ root: Node }> {
		this.log("applying %s %O", id, message)

		try {
			await this.#apply.apply(txn, [id, signature, message])
		} catch (error) {
			this.dispatchEvent(new CustomEvent("error", { detail: { error } }))
			throw error
		}

		this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message } }))
		await txn.insert(id, signature, message, [key, value])

		for (const [childId, { signature, message }] of this.mempool.observe(id)) {
			await this.#insert(txn, childId, signature, message)
		}

		const root = await txn.messages.getRoot()
		return { root }
	}

	/**
	 * Sync with a remote source, applying and inserting all missing messages into the local log
	 */
	public async sync(
		source: Source,
		options: { sourceId?: string; timeoutController?: DelayableController } = {},
	): Promise<{ root: Node; messageCount: number }> {
		let messageCount = 0
		const start = performance.now()
		const root = await this.write(async (txn) => {
			const driver = new Driver(this.topic, source, txn.messages)
			for await (const [key, value] of driver.sync()) {
				const [id, signature, message] = this.decode(value)
				assert(id === decodeId(key), "expected id === decodeId(key)")
				await this.#verifySignature(signature, message)

				const leaf = await txn.messages.getNode(0, encodeId(id))
				if (leaf === null) {
					for (const parent of message.parents) {
						// TODO: txn.messages.getMany
						const leaf = await txn.messages.getNode(0, encodeId(parent))
						if (leaf === null) {
							this.log.error("missing parent %s of message %s: %O", parent, id, message)
							if (this.indexAncestors) {
								throw new Error(`missing parent ${parent} of message ${id}`)
							} else {
								continue // don't try to insert, just skip and try to get the message on the next sync
							}
						}
					}

					await this.#insert(txn, id, signature, message, [key, value])
					if (options.timeoutController) options.timeoutController.delay()
					messageCount++
				}
			}

			return await txn.messages.getRoot()
		}, options)

		const duration = Math.ceil(performance.now() - start)
		const peer = options.sourceId

		this.dispatchEvent(new CustomEvent("sync", { detail: { peer, duration, messageCount } }))
		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
		this.log("commited root %s", hex(root.hash))
		return { root, messageCount }
	}

	/**
	 * Serve a read-only snapshot of the merkle tree
	 */
	public async serve(callback: (source: Source) => Promise<void>, options: { targetId?: string } = {}) {
		await this.read((txn) => callback(txn.messages), options)
	}
}
