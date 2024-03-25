import type { Source, Target, Node, Bound, KeyValueStore, Entry } from "@canvas-js/okra"

import { TypedEventEmitter, CustomEvent } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"

import * as cbor from "@ipld/dag-cbor"

import { bytesToHex as hex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { Mempool } from "./Mempool.js"
import { Driver } from "./sync/driver.js"
import { decodeClock } from "./clock.js"
import {
	decodeId,
	encodeId,
	encodeSignedMessage,
	getNextClock,
	KEY_LENGTH,
	messageIdPattern,
	MIN_MESSAGE_ID,
	MAX_MESSAGE_ID,
	decodeSignedMessage,
} from "./schema.js"
import { topicPattern, cborNull, getAncestorClocks, DelayableController } from "./utils.js"

export interface ReadOnlyTransaction {
	getHeads(): Awaitable<Uint8Array[]>

	messages: Omit<KeyValueStore, "set" | "delete"> & Source
	heads: Omit<KeyValueStore, "set" | "delete">
	ancestors?: Omit<KeyValueStore, "set" | "delete">
	getAncestors?: (key: Uint8Array, atOrBefore: number) => Awaitable<Uint8Array[]>
	isAncestor?: (key: Uint8Array, ancestorKey: Uint8Array) => Awaitable<boolean>
}

export interface ReadWriteTransaction {
	getHeads(): Awaitable<Uint8Array[]>

	messages: KeyValueStore & Target
	heads: KeyValueStore
	ancestors?: KeyValueStore
	getAncestors?: (key: Uint8Array, atOrBefore: number) => Awaitable<Uint8Array[]>
	isAncestor?: (key: Uint8Array, ancestorKey: Uint8Array) => Awaitable<boolean>
	insertUpdatingAncestors?: (
		key: Uint8Array,
		value: Uint8Array,
		parents: Uint8Array[],
		ancestorClocks: number[],
	) => Awaitable<Uint8Array[][]>
	insertMessageRemovingHeads?: (
		key: Uint8Array,
		value: Uint8Array,
		cborNull: Uint8Array,
		heads: Uint8Array[],
	) => Awaitable<void>
}

export type GossipLogConsumer<Payload = unknown, Result = void> = (
	id: string,
	signature: Signature,
	message: Message<Payload>,
) => Awaitable<Result>

export interface GossipLogInit<Payload = unknown, Result = void> {
	topic: string
	apply: GossipLogConsumer<Payload, Result>
	validatePayload?: (payload: unknown) => payload is Payload
	verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>

	signer?: Pick<Signer<Payload>, "sign" | "verify">
	indexAncestors?: boolean
}

export type GossipLogEvents<Payload = unknown, Result = void> = {
	message: CustomEvent<{ id: string; signature: Signature; message: Message<Payload>; result: Result }>
	commit: CustomEvent<{ root: Node }>
	sync: CustomEvent<{ peer?: string; duration: number; messageCount: number }>
	error: CustomEvent<{ error: Error }>
}

export abstract class AbstractGossipLog<Payload = unknown, Result = unknown> extends TypedEventEmitter<
	GossipLogEvents<Payload, Result>
> {
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
	readonly #apply: GossipLogConsumer<Payload, Result>

	protected constructor(init: GossipLogInit<Payload, Result>) {
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
			for await (const [key, value] of txn.messages.entries()) {
				const [id, signature, message] = this.decode(value)
				assert(id === decodeId(key), "expected id === decodeId(key)")
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
		return await this.read(({ messages }) => messages.get(encodeId(id)) !== null)
	}

	public async get(id: string): Promise<[signature: Signature, message: Message<Payload>] | [null, null]> {
		assert(messageIdPattern.test(id), "invalid message ID")
		const value = await this.read(({ messages }) => messages.get(encodeId(id)))
		if (value === null) {
			return [null, null]
		}

		const [_, signature, message] = this.decode(value)
		return [signature, message]
	}

	/**
	 * Sign and append a new *unsigned* message to the end of the log.
	 * The currently unmerged heads of the local log are used as parents.
	 */
	public async append(
		payload: Payload,
		options: { signer?: Pick<Signer<Payload>, "sign" | "verify"> } = {},
	): Promise<{ id: string; signature: Signature; message: Message<Payload>; result: Result }> {
		const signer = options.signer ?? this.signer

		const { id, signature, message, result, root } = await this.write(async (txn) => {
			const heads = await txn.getHeads()

			const clock = getNextClock(heads)

			const parents = heads.map(decodeId)
			const message: Message<Payload> = { topic: this.topic, clock, parents, payload }
			const signature = await signer.sign(message)
			const [key, value] = this.encode(signature, message)

			const id = decodeId(key)
			this.log("appending message %s: %O", id, message)
			const result = await this.#insert(txn, id, signature, message, [key, value])
			const root = await txn.messages.getRoot()
			return { id, signature, message, result, root }
		})

		this.dispatchEvent(new CustomEvent("commit", { detail: { topic: this.topic, root } }))
		this.log("commited root %s", hex(root.hash))

		return { id, signature, message, result }
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
				const parent = await txn.messages.get(encodeId(parentId))
				if (parent === null) {
					this.log("missing parent %s", parentId)
					missingParents.add(parentId)
				} else {
					this.log("found parent %s", parentId)
				}
			}

			if (missingParents.size > 0) {
				this.log("missing %d/%d parents", missingParents.size, message.parents.length)
				this.mempool.add(id, { signature, message }, missingParents)
				return { id }
			}

			await this.#insert(txn, id, signature, message, [key, value])
			const root = await txn.messages.getRoot()

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
		await this.read((txn) => {
			return txn.getAncestors
				? this.#getAncestorsByTxn(txn, encodeId(id), atOrBefore, results)
				: this.#getAncestors(txn, encodeId(id), atOrBefore, results)
		})
		this.log("getAncestors of %s atOrBefore %d: %o", id, atOrBefore, results)
		return Array.from(results).sort()
	}

	public async isAncestor(id: string, ancestor: string): Promise<boolean> {
		assert(messageIdPattern.test(id), "invalid message ID")
		return await this.read((txn) =>
			txn.isAncestor
				? AbstractGossipLog.isAncestorByTxn(txn, id, ancestor)
				: AbstractGossipLog.isAncestor(txn, id, ancestor),
		)
	}

	static async isAncestorByTxn(txn: ReadOnlyTransaction, id: string, ancestor: string): Promise<boolean> {
		assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
		assert(txn.isAncestor !== undefined, "expected txn.isAncestor !== undefined")
		assert(messageIdPattern.test(id), "invalid message ID (id)")
		assert(messageIdPattern.test(ancestor), "invalid message ID (ancestor)")

		if (id === ancestor) {
			return true
		}

		const key = encodeId(id)
		const ancestorKey = encodeId(ancestor)
		const result = await txn.isAncestor(key, ancestorKey)

		return result
	}

	static async isAncestor(
		txn: ReadOnlyTransaction,
		id: string,
		ancestor: string,
		visited = new Set<string>(),
	): Promise<boolean> {
		assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
		assert(messageIdPattern.test(id), "invalid message ID (id)")
		assert(messageIdPattern.test(ancestor), "invalid message ID (ancestor)")

		if (id === ancestor) {
			return true
		}

		const ancestorKey = encodeId(ancestor)
		const [ancestorClock] = decodeClock(ancestorKey)

		const key = encodeId(id)
		const [clock] = decodeClock(key)

		if (clock <= ancestorClock) {
			return false
		}

		const index = Math.floor(Math.log2(Number(clock - ancestorClock)))
		const value = await txn.ancestors.get(key)
		assert(value !== null, "key not found in ancestor index")

		const links = cbor.decode<Uint8Array[][]>(value)
		for (const key of links[index]) {
			const id = decodeId(key)

			if (visited.has(id)) {
				continue
			}

			visited.add(id)
			const isAncestor = await AbstractGossipLog.isAncestor(txn, id, ancestor, visited)
			if (isAncestor) {
				return true
			}
		}

		return false
	}

	async #getAncestorsByTxn(
		txn: ReadOnlyTransaction | ReadWriteTransaction,
		key: Uint8Array,
		atOrBefore: number,
		results: Set<string>,
	) {
		assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
		assert(txn.getAncestors !== undefined, "expected txn.getAncestors !== undefined")

		const links = await txn.getAncestors(key, atOrBefore)

		for (const ancestorKey of links) {
			const [ancestorClock] = decodeClock(ancestorKey)
			const ancestorId = decodeId(ancestorKey)
			if (Number(ancestorClock) <= atOrBefore) {
				results.add(ancestorId)
			}
		}
	}

	async #getAncestors(
		txn: ReadOnlyTransaction,
		key: Uint8Array,
		atOrBefore: number,
		results: Set<string>,
		visited = new Set<string>(),
	): Promise<void> {
		assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
		assert(atOrBefore > 0, "expected atOrBefore > 0")

		const [clock] = decodeClock(key)
		assert(atOrBefore < Number(clock), "expected atOrBefore < clock")

		const index = Math.floor(Math.log2(Number(clock) - atOrBefore))
		const value = await txn.ancestors.get(key)
		if (value === null) {
			throw new Error(`key ${decodeId(key)} not found in ancestor index`)
		}

		const links = cbor.decode<Uint8Array[][]>(value)
		for (const ancestorKey of links[index]) {
			const [ancestorClock] = decodeClock(ancestorKey)
			const ancestorId = decodeId(ancestorKey)

			if (Number(ancestorClock) <= atOrBefore) {
				results.add(ancestorId)
			} else if (visited.has(ancestorId)) {
				return
			} else {
				visited.add(ancestorId)
				await this.#getAncestors(txn, ancestorKey, atOrBefore, results, visited)
			}
		}
	}

	async #insert(
		txn: ReadWriteTransaction,
		id: string,
		signature: Signature,
		message: Message<Payload>,
		[key, value]: Entry = this.encode(signature, message),
	): Promise<Result> {
		this.log("applying %s %O", id, message)
		let result
		try {
			result = await this.#apply.apply(txn, [id, signature, message])
		} catch (error) {
			this.dispatchEvent(new CustomEvent("error", { detail: { error } }))
			throw error
		}

		this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))

		const parentKeys = message.parents.map(encodeId)
		if (txn.insertMessageRemovingHeads) {
			await txn.insertMessageRemovingHeads(key, value, cborNull, message.parents.map(encodeId))
		} else {
			await txn.messages.set(key, value)
			await txn.heads.set(key, cborNull)
			for (const parentKey of parentKeys) {
				await txn.heads.delete(parentKey)
			}
		}

		if (this.indexAncestors) {
			assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")

			const ancestorClocks = Array.from(getAncestorClocks(message.clock))
			const ancestorLinks: Uint8Array[][] = new Array(ancestorClocks.length)

			if (txn.insertUpdatingAncestors) {
				const ancestorLinks = await txn.insertUpdatingAncestors(key, value, parentKeys, ancestorClocks)
				await txn.ancestors.set(key, cbor.encode(ancestorLinks))
			} else {
				for (const [i, ancestorClock] of ancestorClocks.entries()) {
					if (i === 0) {
						ancestorLinks[i] = parentKeys
					} else {
						const links = new Set<string>()
						for (const child of ancestorLinks[i - 1]) {
							const [childClock] = decodeClock(child)
							if (childClock <= ancestorClock) {
								links.add(decodeId(child))
							} else {
								assert(childClock <= ancestorClocks[i - 1], "expected childClock <= ancestorClocks[i - 1]")
								if (txn.getAncestors !== undefined) {
									await this.#getAncestorsByTxn(txn, child, ancestorClock, links)
								} else {
									await this.#getAncestors(txn, child, ancestorClock, links)
								}
							}
						}

						ancestorLinks[i] = Array.from(links).map(encodeId)
					}
				}

				await txn.ancestors.set(key, cbor.encode(ancestorLinks))
			}
		}

		for (const [childId, { signature, message }] of this.mempool.observe(id)) {
			await this.#insert(txn, childId, signature, message)
		}

		return result
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

				const existingMessage = await txn.messages.get(key)
				if (existingMessage === null) {
					for (const parent of message.parents) {
						// TODO: txn.messages.getMany
						const parentKey = encodeId(parent)
						const parentValue = await txn.messages.get(parentKey)
						if (parentValue === null) {
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
