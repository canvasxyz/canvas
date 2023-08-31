import type { PeerId } from "@libp2p/interface-peer-id"
import type { Source, Target, Node, Bound } from "@canvas-js/okra"

import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"
import { Logger, logger } from "@libp2p/logger"
import { base32 } from "multiformats/bases/base32"
import { equals } from "uint8arrays"
import * as cbor from "@ipld/dag-cbor"

import type { Message } from "@canvas-js/interfaces"
import { Signature, verifySignature } from "@canvas-js/signed-cid"

import { KEY_LENGTH, decodeSignedMessage, encodeSignedMessage, getClock } from "../schema.js"
import { Awaitable, assert, nsidPattern } from "../utils.js"
import { Driver } from "../sync/driver.js"

export interface ReadOnlyTransaction extends Target {
	get(key: Uint8Array): Awaitable<Uint8Array | null>
	getUserdata(): Awaitable<Uint8Array | null>
}

export interface ReadWriteTransaction extends ReadOnlyTransaction {
	set(key: Uint8Array, value: Uint8Array): Awaitable<void>
	delete(key: Uint8Array): Awaitable<void>
	setUserdata(userdata: Uint8Array | null): Awaitable<void>
}

export interface MessageLogInit<Payload = unknown, Result = void> {
	location: string | null
	topic: string
	apply: (id: string, signature: Signature | null, message: Message<Payload>) => Awaitable<Result>
	validate: (payload: unknown) => payload is Payload

	signatures?: boolean
	sequencing?: boolean
	replay?: boolean
}

export interface MessageSigner<Payload = unknown> {
	sign: (message: Message<Payload>) => Awaitable<Signature | null>
}

export abstract class AbstractMessageLog<Payload = unknown, Result = unknown> extends EventEmitter<{
	message: CustomEvent<{ id: string; signature: Signature | null; message: Message<Payload>; result: Result }>
	commit: CustomEvent<{ root: Node }>
	sync: CustomEvent<{ peerId: PeerId }>
}> {
	private static defaultSigner: MessageSigner = { sign: ({}) => null }
	private static decodeBound = (bound: { id: string; inclusive: boolean } | null) =>
		bound && { key: base32.baseDecode(bound.id), inclusive: bound.inclusive }

	public abstract close(): Promise<void>

	protected abstract entries(
		lowerBound?: Bound<Uint8Array> | null,
		upperBound?: Bound<Uint8Array> | null,
		options?: { reverse?: boolean }
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]>

	protected abstract read<T>(
		callback: (txn: ReadOnlyTransaction) => Promise<T>,
		options?: { target?: PeerId }
	): Promise<T>

	protected abstract write<T>(
		callback: (txn: ReadWriteTransaction) => Promise<T>,
		options?: { source?: PeerId }
	): Promise<T>

	public readonly location: string | null
	public readonly topic: string
	public readonly apply: (id: string, signature: Signature | null, message: Message<Payload>) => Awaitable<Result>
	public readonly validate: (payload: unknown) => payload is Payload

	public readonly signatures: boolean
	public readonly sequencing: boolean

	protected readonly log: Logger

	protected constructor(init: MessageLogInit<Payload, Result>) {
		super()
		assert(nsidPattern.test(init.topic), "invalid topic (must match [a-zA-Z0-9\\.\\-]+)")

		this.location = init.location
		this.topic = init.topic
		this.apply = init.apply
		this.validate = init.validate

		this.signatures = init.signatures ?? true
		this.sequencing = init.sequencing ?? true

		this.log = logger(`canvas:gossiplog:[${this.topic}]`)
	}

	public async *iterate(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[id: string, signature: Signature | null, message: Message<Payload>]> {
		for await (const [key, value] of this.entries(
			AbstractMessageLog.decodeBound(lowerBound),
			AbstractMessageLog.decodeBound(upperBound),
			options
		)) {
			const [recoveredKey, signature, message] = this.decode(value)
			assert(equals(recoveredKey, key), "expected equals(recoveredKey, key)")
			yield [base32.baseEncode(key), signature, message]
		}
	}

	public encode(signature: Signature | null, message: Message<Payload>): [key: Uint8Array, value: Uint8Array] {
		if (this.sequencing) {
			assert(message.clock > 0, "expected message.clock > 0 if sequencing is enable")
		} else {
			assert(message.clock === 0, "expected message.clock === 0 if sequencing is disabled")
		}

		if (this.signatures) {
			assert(signature !== null, "missing message signature")
		}

		return encodeSignedMessage(signature, message)
	}

	public decode(value: Uint8Array): [key: Uint8Array, signature: Signature | null, message: Message<Payload>] {
		const [key, signature, message] = decodeSignedMessage(value)
		if (this.signatures) {
			assert(signature !== null, "missing message signature")
		}

		const { clock, parents, payload } = message
		if (this.sequencing) {
			assert(clock > 0, "expected message.clock > 0 if sequencing is enable")
		} else {
			assert(clock === 0, "expected message.clock === 0 if sequencing is disabled")
		}

		assert(this.validate(payload), "invalid message payload")

		return [key, signature, { clock, parents, payload }]
	}

	public async get(id: string): Promise<[signature: Signature | null, message: Message<Payload> | null]> {
		const key = base32.baseDecode(id)
		assert(key.length === KEY_LENGTH, "invalid id")

		const value = await this.read(async (txn) => txn.get(key))
		if (value === null) {
			return [null, null]
		}

		const [recoveredKey, signature, message] = this.decode(value)
		assert(equals(recoveredKey, key), "invalid message key")
		return [signature, message]
	}

	/**
	 * Insert an existing signed message into the log (ie received via PubSub)
	 */
	public async insert(signature: Signature | null, message: Message<Payload>) {
		return await this.write(async (txn) => {
			const userdata = await txn.getUserdata()
			const graph = Graph.import(this.topic, this.sequencing, userdata)

			const [key, value] = this.encode(signature, message)

			const id = base32.baseEncode(key)
			const result = await this.apply(id, signature, message)
			this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))

			await txn.set(key, value)
			graph.update(key, message)

			await txn.setUserdata(graph.export())

			const root = await txn.getRoot()
			return { id, key, value, result, root }
		})
	}

	/**
	 * Append a new message to the end of the log, using all the latest concurrent messages as parents
	 */
	public async append(payload: Payload, options: { signer?: MessageSigner<Payload> } = {}) {
		const signer = options.signer ?? AbstractMessageLog.defaultSigner

		return await this.write(async (txn) => {
			const userdata = await txn.getUserdata()
			const graph = Graph.import(this.topic, this.sequencing, userdata)

			const message = graph.create(payload)
			const signature = await signer.sign(message)
			const [key, value] = this.encode(signature, message)

			const id = base32.baseEncode(key)
			const result = await this.apply(id, signature, message)
			this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))

			await txn.set(key, value)
			graph.update(key, message)

			await txn.setUserdata(graph.export())

			const root = await txn.getRoot()
			return { id, key, value, result, root }
		})
	}

	/**
	 * Sync with a remote source, applying and inserting all missing messages into the local log
	 */
	public async sync(sourcePeerId: PeerId, source: Source): Promise<{ root: Node }> {
		const root = await this.write(
			async (target) => {
				const userdata = await target.getUserdata()
				const graph = Graph.import(this.topic, this.sequencing, userdata)

				const driver = new Driver(this.topic, source, target)
				for await (const [key, value] of driver.sync()) {
					const id = base32.baseEncode(key)

					const [recoveredKey, signature, message] = this.decode(value)

					assert(equals(key, recoveredKey), "invalid message key")

					if (this.signatures) {
						assert(signature !== null, "missing message signature")
						verifySignature(signature, message)
					}

					const result = await this.apply(id, signature, message)
					this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))

					await target.set(key, value)
					graph.update(key, message)
				}

				await target.setUserdata(graph.export())
				return await target.getRoot()
			},
			{ source: sourcePeerId }
		)

		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
		this.dispatchEvent(new CustomEvent("sync", { detail: { peerId: sourcePeerId } }))
		return { root }
	}

	/**
	 * Serve a read-only snapshot of the merkle tree
	 */
	public async serve(targetPeerId: PeerId, callback: (source: Source) => Promise<void>) {
		await this.read(callback, { target: targetPeerId })
	}
}

class Graph {
	private readonly log: Logger

	readonly #parents = new Set<string>()

	public static import(topic: string, sequencing: boolean, userdata: Uint8Array | null): Graph {
		if (sequencing === false) {
			return new Graph(topic, sequencing, [])
		}

		const parents = userdata === null ? [] : cbor.decode<Uint8Array[]>(userdata)
		return new Graph(topic, sequencing, parents)
	}

	constructor(topic: string, private readonly sequencing: boolean, parents: Uint8Array[]) {
		const clock = getClock(parents)
		this.log = logger(`canvas:gossiplog:[${topic}]:graph`)
		this.log("loaded graph at clock %d", clock)
		for (const key of parents) {
			const id = base32.baseEncode(key)
			this.log("added %s", id)
			this.#parents.add(id)
		}
	}

	public export(): Uint8Array | null {
		if (this.sequencing === false) {
			return null
		}

		const parents = this.getParents()
		const clock = getClock(parents)

		this.log("saving graph at clock %d", clock)
		return cbor.encode(parents)
	}

	public update<Payload>(key: Uint8Array, message: Message<Payload>) {
		if (this.sequencing === false) {
			return
		}

		for (const parent of message.parents) {
			const parentId = base32.baseEncode(parent)
			if (this.#parents.delete(parentId)) {
				this.log("removed %s", parentId)
			}
		}

		const id = base32.baseEncode(key)
		this.log("added %s", id)
		this.#parents.add(id)
	}

	public create<Payload>(payload: Payload): Message<Payload> {
		if (this.sequencing === false) {
			return { clock: 0, parents: [], payload }
		}

		const parents = this.getParents()
		const clock = getClock(parents)

		return { clock, parents, payload }
	}

	private getParents(): Uint8Array[] {
		if (this.sequencing === false) {
			return []
		}

		return [...this.#parents].map(base32.baseDecode).sort()
	}
}
