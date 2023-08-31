import type { PeerId } from "@libp2p/interface-peer-id"
import type { Source, Target, Node } from "@canvas-js/okra"

import * as cbor from "@ipld/dag-cbor"
import { base32 } from "multiformats/bases/base32"
import { equals } from "uint8arrays"
import { Logger, logger } from "@libp2p/logger"

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

export abstract class AbstractMessageLog<Payload = unknown, Result = unknown> {
	private static defaultSigner: MessageSigner = { sign: ({}) => null }

	public abstract close(): Promise<void>

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
		assert(nsidPattern.test(init.topic), "invalid topic (must match [a-zA-Z0-9\\.\\-]+)")

		this.location = init.location
		this.topic = init.topic
		this.apply = init.apply
		this.validate = init.validate

		this.signatures = init.signatures ?? true
		this.sequencing = init.sequencing ?? true

		this.log = logger(`canvas:gossiplog:[${this.topic}]`)
	}

	// public async getSequence(): Promise<[clock: number, parents: Uint8Array[]]> {
	// 	return await this.read(async (txn) => {
	// 		const graph = await Graph.import(this.topic, txn)
	// 		return graph.export()
	// 	})
	// }

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
			const graph = await Graph.import(this.topic, this.sequencing, txn)

			const [key, value] = this.encode(signature, message)

			const id = base32.baseEncode(key)
			const result = await this.apply(id, signature, message)

			await txn.set(key, value)
			graph.update(key, message)

			await graph.save(txn)

			const root = await txn.getRoot()
			return { id, key, value, result, root }
		})
	}

	private async importGraph(txn: ReadWriteTransaction): Promise<Graph> {
		const graph = await Graph.import(this.topic, this.sequencing, txn)
		return graph
	}

	/**
	 * Append a new message to the end of the log, using all the latest concurrent messages as parents
	 */
	public async append(payload: Payload, options: { signer?: MessageSigner<Payload> } = {}) {
		const signer = options.signer ?? AbstractMessageLog.defaultSigner

		return await this.write(async (txn) => {
			const graph = await this.importGraph(txn)

			const message = graph.createMessage(payload)
			const signature = await signer.sign(message)
			const [key, value] = this.encode(signature, message)

			const id = base32.baseEncode(key)
			const result = await this.apply(id, signature, message)

			await txn.set(key, value)
			graph.update(key, message)

			await graph.save(txn)

			const root = await txn.getRoot()
			return { id, key, value, result, root }
		})
	}

	/**
	 * Sync with a remote source, applying and inserting all missing messages into the local log
	 */
	public async sync(sourcePeerId: PeerId, source: Source): Promise<{ root: Node }> {
		return await this.write(
			async (target) => {
				const graph = await Graph.import(this.topic, this.sequencing, target)

				const driver = new Driver(this.topic, source, target)
				for await (const [key, value] of driver.sync()) {
					const id = base32.baseEncode(key)

					const [recoveredKey, signature, message] = this.decode(value)

					assert(equals(key, recoveredKey), "invalid message key")

					if (this.signatures) {
						assert(signature !== null, "missing message signature")
						verifySignature(signature, message)
					}

					await this.apply(id, signature, message)
					await target.set(key, value)
					graph.update(key, message)
				}

				await graph.save(target)

				const root = await target.getRoot()
				return { root }
			},
			{ source: sourcePeerId }
		)
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

	public static async import(topic: string, sequencing: boolean, txn: ReadOnlyTransaction): Promise<Graph> {
		if (sequencing === false) {
			return new Graph(topic, sequencing, [])
		}

		const userdata = await txn.getUserdata()
		const parents = userdata === null ? [] : cbor.decode<Uint8Array[]>(userdata)
		return new Graph(topic, sequencing, parents)
	}

	constructor(topic: string, private readonly sequencing: boolean, parents: Uint8Array[]) {
		const clock = getClock(parents)
		this.log = logger(`canvas:gossiplog:[${topic}]:graph`)
		this.log("created graph at clock %d", clock)
		for (const key of parents) {
			const id = base32.baseEncode(key)
			this.log("added %s", id)
			this.#parents.add(id)
		}
	}

	public async save(txn: ReadWriteTransaction) {
		if (this.sequencing === false) {
			return
		}

		const [clock, parents] = this.export()
		this.log("saving graph at clock %d", clock)
		await txn.setUserdata(cbor.encode(parents))
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

	public createMessage<Payload>(payload: Payload): Message<Payload> {
		const [clock, parents] = this.export()
		return { clock, parents, payload }
	}

	public export(): [clock: number, parents: Uint8Array[]] {
		if (this.sequencing === false) {
			return [0, []]
		}

		const parents = [...this.#parents].map(base32.baseDecode)
		const clock = getClock(parents)
		return [clock, parents]
	}
}
