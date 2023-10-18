import type { PeerId } from "@libp2p/interface-peer-id"
import type { Source, Target, Node, Bound, KeyValueStore, Entry } from "@canvas-js/okra"

import { CustomEvent, EventEmitter } from "@libp2p/interface/events"
import { Logger, logger } from "@libp2p/logger"
import { equals } from "uint8arrays"
import { varint } from "multiformats/basics"
import { bytesToHex as hex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"
import { Schema } from "@ipld/schema/schema-schema"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create, TypeTransformerFunction } from "@ipld/schema/typed.js"

import type { Message } from "@canvas-js/interfaces"
import { Signature, verifySignature } from "@canvas-js/signed-cid"

import { Driver } from "./sync/driver.js"
import { decodeId, encodeId, decodeSignedMessage, encodeSignedMessage, getClock } from "./schema.js"
import { Awaitable, assert, topicPattern, cborNull, getAncestorClocks } from "./utils.js"

export interface ReadOnlyTransaction {
	messages: Omit<KeyValueStore, "set" | "delete"> & Source
	parents: Omit<KeyValueStore, "set" | "delete">
	ancestors?: Omit<KeyValueStore, "set" | "delete">
}

export interface ReadWriteTransaction {
	messages: KeyValueStore & Target
	parents: KeyValueStore
	ancestors?: KeyValueStore
}

export type GossipLogConsumer<Payload = unknown, Result = void> = (
	id: string,
	signature: Signature | null,
	message: Message<Payload>
) => Awaitable<Result>

export interface GossipLogInit<Payload = unknown, Result = void> {
	topic: string
	apply: GossipLogConsumer<Payload, Result>
	validate: ((payload: unknown) => payload is Payload) | { schema: string | Schema; name: string }

	signatures?: boolean
	sequencing?: boolean
	replay?: boolean
	indexAncestors?: boolean
}

export interface MessageSigner<Payload = unknown> {
	sign: (message: Message<Payload>) => Awaitable<Signature | null>
}

export type GossipLogEvents<Payload = unknown, Result = void> = {
	message: CustomEvent<{
		topic: string
		id: string
		signature: Signature | null
		message: Message<Payload>
		result: Result
	}>
	commit: CustomEvent<{ topic: string; root: Node }>
	sync: CustomEvent<{ topic: string; peerId: PeerId }>
}

export abstract class AbstractGossipLog<Payload = unknown, Result = unknown> extends EventEmitter<
	GossipLogEvents<Payload, Result>
> {
	private static defaultSigner: MessageSigner = { sign: ({}) => null }
	private static bound = (id: string | null = null, inclusive = true) =>
		id === null ? null : { key: encodeId(id), inclusive }

	public abstract close(): Promise<void>

	protected abstract entries(
		lowerBound?: Bound<Uint8Array> | null,
		upperBound?: Bound<Uint8Array> | null,
		options?: { reverse?: boolean }
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]>

	protected abstract read<T>(
		callback: (txn: ReadOnlyTransaction) => Awaitable<T>,
		options?: { target?: PeerId }
	): Promise<T>

	protected abstract write<T>(
		callback: (txn: ReadWriteTransaction) => Awaitable<T>,
		options?: { source?: PeerId }
	): Promise<T>

	public readonly topic: string
	public readonly apply: GossipLogConsumer<Payload, Result>

	public readonly signatures: boolean
	public readonly sequencing: boolean
	public readonly indexAncestors: boolean

	protected readonly log: Logger
	protected readonly mempool = new Mempool<Payload>()
	protected readonly toTyped: TypeTransformerFunction
	protected readonly toRepresentation: TypeTransformerFunction

	protected constructor(init: GossipLogInit<Payload, Result>) {
		super()
		assert(topicPattern.test(init.topic), "invalid topic (must match [a-zA-Z0-9\\.\\-])")

		this.topic = init.topic
		this.apply = init.apply

		if (typeof init.validate === "function") {
			const { validate } = init

			this.toTyped = (obj) => {
				assert(validate(obj), "invalid message payload")
				return obj
			}

			this.toRepresentation = (obj) => {
				assert(validate(obj), "invalid message payload")
				return obj
			}
		} else {
			const { schema, name } = init.validate
			const { toRepresentation, toTyped } = create(typeof schema === "string" ? fromDSL(schema) : schema, name)
			this.toTyped = toTyped
			this.toRepresentation = toRepresentation
		}

		this.signatures = init.signatures ?? true
		this.sequencing = init.sequencing ?? true
		this.indexAncestors = init.indexAncestors ?? false
		if (this.indexAncestors) {
			assert(this.sequencing, "indexAncestors cannot be set if sequencing is disabled")
		}

		this.log = logger(`canvas:gossiplog:[${this.topic}]`)
	}

	protected async replay() {
		for await (const [id, signature, message] of this.iterate()) {
			if (this.signatures) {
				assert(signature !== null, "missing message signature")
				verifySignature(signature, message)
			}
			assert(message.topic === this.topic, "invalid message topic")
			await this.apply(id, signature, message)
		}
	}

	public async *iterate(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[id: string, signature: Signature | null, message: Message<Payload>]> {
		for await (const [key, value] of this.entries(
			AbstractGossipLog.bound(lowerBound?.id, lowerBound?.inclusive),
			AbstractGossipLog.bound(upperBound?.id, upperBound?.inclusive),
			options
		)) {
			const [id, signature, message] = this.decode(value)
			assert(id === decodeId(key), "expected id === decodeId(key)")
			yield [id, signature, message]
		}
	}

	public encode(
		signature: Signature | null,
		{ topic, clock, parents, payload }: Message<Payload>
	): [key: Uint8Array, value: Uint8Array] {
		if (this.sequencing) {
			assert(clock > 0, "expected message.clock > 0 if sequencing is enabled")
		} else {
			assert(clock === 0, "expected message.clock === 0 if sequencing is disabled")
		}

		if (this.signatures) {
			assert(signature !== null, "missing message signature")
		}

		return encodeSignedMessage(signature, { topic, clock, parents, payload: this.toRepresentation(payload) })
	}

	public decode(value: Uint8Array): [id: string, signature: Signature | null, message: Message<Payload>] {
		const [id, signature, { topic, clock, parents, payload }] = decodeSignedMessage(this.topic, value)
		if (this.signatures) {
			assert(signature !== null, "missing message signature")
		}

		if (this.sequencing) {
			assert(clock > 0, "expected message.clock > 0 if sequencing is enabled")
		} else {
			assert(clock === 0, "expected message.clock === 0 if sequencing is disabled")
		}

		return [id, signature, { topic, clock, parents, payload: this.toTyped(payload) }]
	}

	public async getClock(): Promise<[clock: number, parents: string[]]> {
		if (this.sequencing === false) {
			return [0, []]
		}

		const parents = await this.read((txn) => this.getParents(txn))
		const clock = getClock(parents)
		return [clock, parents.map(decodeId)]
	}

	public async get(id: string): Promise<[signature: Signature | null, message: Message<Payload> | null]> {
		const value = await this.read(({ messages }) => messages.get(encodeId(id)))
		if (value === null) {
			return [null, null]
		}

		const [_, signature, message] = this.decode(value)
		return [signature, message]
	}

	private async getParents(txn: ReadOnlyTransaction): Promise<Uint8Array[]> {
		const parents: Uint8Array[] = []
		for await (const [key, value] of txn.parents.entries()) {
			assert(equals(value, cborNull), "internal error - unexpected parent entry value")
			parents.push(key)
		}

		return parents
	}

	/**
	 * Append a new message to the end of the log
	 */
	public async append(
		payload: Payload,
		options: { signer?: MessageSigner<Payload> } = {}
	): Promise<{ id: string; signature: Signature | null; message: Message<Payload>; result: Result }> {
		const signer = options.signer ?? AbstractGossipLog.defaultSigner

		const { id, signature, message, result, root } = await this.write(async (txn) => {
			const parents = await this.getParents(txn)
			const clock = this.sequencing ? getClock(parents) : 0

			const message: Message<Payload> = { topic: this.topic, clock, parents: parents.map(decodeId), payload }
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
	 * Insert an existing signed message into the log (ie received via PubSub)
	 * If any of the parents are not present, insert the message into the mempool instead.
	 */
	public async insert(signature: Signature | null, message: Message<Payload>): Promise<{ id: string }> {
		if (this.signatures) {
			assert(signature !== null, "missing message signature")
			verifySignature(signature, message)
		}

		const { id, root } = await this.write(async (txn) => {
			const [key, value] = this.encode(signature, message)
			const id = decodeId(key)

			this.log("inserting message %s", id)

			const dependencies = new Set<string>()
			this.log("looking up %s parents", message.parents.length)
			for (const parentId of message.parents) {
				const parent = await txn.messages.get(encodeId(parentId))
				if (parent === null) {
					this.log("missing parent %s", parentId)
					dependencies.add(parentId)
				} else {
					this.log("found parent %s", parentId)
				}
			}

			if (dependencies.size > 0) {
				this.log("missing %d/%d parents", dependencies.size, message.parents.length)
				this.log("mempool.messages.set(%s, ...)", id)
				this.mempool.messages.set(id, { signature, message })
				this.log("mempool.dependencies.set(%s, %o)", id, dependencies)
				this.mempool.dependencies.set(id, dependencies)

				for (const parent of dependencies) {
					this.log("mempool.children[%s].add(%s)", parent, id)
					const children = this.mempool.children.get(parent)
					if (children === undefined) {
						this.mempool.children.set(parent, new Set([id]))
					} else {
						children.add(id)
					}
				}

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

	public async getAncestors(id: string, ancestorClock: number): Promise<string[]> {
		const results = new Set<string>()
		await this.write((txn) => this.#getAncestors(txn, encodeId(id), ancestorClock, results))
		this.log("getAncestors of %s atOrBefore %d: %o", id, ancestorClock, results)
		return Array.from(results).sort()
	}

	async #getAncestors(
		txn: ReadOnlyTransaction,
		key: Uint8Array,
		atOrBefore: number,
		results: Set<string>,
		visited = new Set<string>()
	): Promise<void> {
		this.log("getAncestors of %s atOrBefore %d (visited: %o)", decodeId(key), atOrBefore, visited)
		assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
		assert(atOrBefore > 0, "expected atOrBefore > 0")

		const [clock] = varint.decode(key)
		assert(atOrBefore < clock, "expected atOrBefore < clock")

		const index = Math.floor(Math.log2(clock - atOrBefore))
		const value = await txn.ancestors.get(key)
		assert(value !== null, "expected value !== null")

		const links = cbor.decode<Uint8Array[][]>(value)
		for (const ancestorKey of links[index]) {
			const [ancestorClock] = varint.decode(ancestorKey)
			const ancestorId = decodeId(ancestorKey)

			if (ancestorClock <= atOrBefore) {
				results.add(ancestorId)
			} else if (visited.has(ancestorId)) {
				throw new Error("I BET THIS NEVER HAPPENS")
			} else {
				visited.add(ancestorId)
				await this.#getAncestors(txn, ancestorKey, atOrBefore, results, visited)
			}
		}
	}

	// async #getAncestors2(txn: ReadOnlyTransaction, key: Uint8Array, atOrBefore: number, results: Set<string>) {
	// 	assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
	// 	assert(atOrBefore > 0, "expected atOrBefore > 0")

	// 	const [clock] = varint.decode(key)
	// 	assert(atOrBefore < clock, "expected atOrBefore < clock")

	// 	const index = Math.floor(Math.log2(clock - atOrBefore))
	// 	const value = await txn.ancestors.get(key)
	// 	assert(value !== null, "expected value !== null")

	// 	const links = cbor.decode<Uint8Array[][]>(value)
	// 	for (const ancestorKey of links[index]) {
	// 		const [ancestorClock] = varint.decode(ancestorKey)
	// 		const ancestorId = decodeId(ancestorKey)

	// 		if (ancestorClock <= atOrBefore) {
	// 			results.add(ancestorId)
	// 		} else if (visited.has(ancestorId)) {
	// 			throw new Error("I BET THIS NEVER HAPPENS")
	// 		} else {
	// 			visited.add(ancestorId)
	// 			await this.#getAncestors(txn, ancestorId, atOrBefore, results, visited)
	// 		}
	// 	}
	// }

	async #insert(
		txn: ReadWriteTransaction,
		id: string,
		signature: Signature | null,
		message: Message<Payload>,
		[key, value]: Entry = this.encode(signature, message)
	): Promise<Result> {
		this.log("applying %s %O", id, message)

		const result = await this.apply(id, signature, message)
		this.dispatchEvent(new CustomEvent("message", { detail: { topic: this.topic, id, signature, message, result } }))
		await txn.messages.set(key, value)

		if (this.sequencing) {
			await txn.parents.set(key, cborNull)
			for (const parentId of message.parents) {
				await txn.parents.delete(encodeId(parentId))
			}

			if (this.indexAncestors) {
				assert(txn.ancestors !== undefined, "expected txn.ancestors !== undefined")

				const parentClocks = Object.fromEntries(
					message.parents.map((parent) => {
						const key = encodeId(parent)
						const [clock] = varint.decode(key)
						return [parent, clock]
					})
				)

				const ancestorClocks = Array.from(getAncestorClocks(message.clock))
				const ancestorLinks: Uint8Array[][] = new Array(ancestorClocks.length)
				for (const [i, ancestorClock] of ancestorClocks.entries()) {
					if (i === 0) {
						ancestorLinks[i] = message.parents.map(encodeId)
					} else {
						const links = new Set<string>()
						for (const child of ancestorLinks[i - 1]) {
							const [childClock] = varint.decode(child)
							if (childClock <= ancestorClock) {
								links.add(decodeId(child))
							} else {
								assert(childClock <= ancestorClocks[i - 1], "expected childClock <= ancestorClocks[i - 1]")
								await this.#getAncestors(txn, child, ancestorClock, links)
							}
						}

						ancestorLinks[i] = Array.from(links).map(encodeId)
					}
				}

				await txn.ancestors.set(key, cbor.encode(ancestorLinks))
			}

			const children = this.mempool.children.get(id)
			this.log("%s has %d mempool children", id, children?.size ?? 0, children)
			if (children !== undefined) {
				for (const childId of children) {
					const dependencies = this.mempool.dependencies.get(childId)
					assert(dependencies !== undefined, "expected dependencies !== undefined")
					const signedMessage = this.mempool.messages.get(childId)
					assert(signedMessage !== undefined, "expected signedMessage !== undefined")

					dependencies.delete(id)
					if (dependencies.size === 0) {
						this.mempool.dependencies.delete(childId)
						this.mempool.messages.delete(childId)
						const { signature, message } = signedMessage
						await this.#insert(txn, childId, signature, message)
					}
				}

				this.mempool.children.delete(id)
			}
		}

		return result
	}

	/**
	 * Sync with a remote source, applying and inserting all missing messages into the local log
	 */
	public async sync(sourcePeerId: PeerId, source: Source): Promise<{ root: Node }> {
		const root = await this.write(
			async (txn) => {
				const driver = new Driver(this.topic, source, txn.messages)
				for await (const [key, value] of driver.sync()) {
					const [id, signature, message] = this.decode(value)
					assert(id === decodeId(key), "expected id === decodeId(key)")

					if (this.signatures) {
						assert(signature !== null, "missing message signature")
						verifySignature(signature, message)
					}

					const existingMessage = await txn.messages.get(key)
					if (existingMessage === null) {
						await this.#insert(txn, id, signature, message, [key, value])
					}
				}

				return await txn.messages.getRoot()
			},
			{ source: sourcePeerId }
		)

		this.dispatchEvent(new CustomEvent("sync", { detail: { topic: this.topic, peerId: sourcePeerId } }))
		this.dispatchEvent(new CustomEvent("commit", { detail: { topic: this.topic, root } }))
		this.log("commited root %s", hex(root.hash))
		return { root }
	}

	/**
	 * Serve a read-only snapshot of the merkle tree
	 */
	public async serve(targetPeerId: PeerId, callback: (source: Source) => Promise<void>) {
		await this.read((txn) => callback(txn.messages), { target: targetPeerId })
	}
}

class Mempool<Payload> {
	/**
	 * `messages` stores entries just like the message database,
	 * with encoded message ids as keys and messages as values.
	 */
	readonly messages = new Map<string, { signature: Signature | null; message: Message<Payload> }>()

	/**
	 * `dependencies` stores the missing parents of the entries in `messages`.
	 */
	readonly dependencies = new Map<string, Set<string>>()

	/**
	 * When we apply any message, we need to look up any mempool entries that
	 * depended on that message that are now eligible for application themselves.
	 * `children` is a map from the parent ids of all mempool
	 * entries to the set of children that depend on them.
	 */
	readonly children = new Map<string, Set<string>>()
}
