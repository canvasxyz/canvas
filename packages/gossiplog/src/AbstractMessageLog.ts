import type { PeerId } from "@libp2p/interface-peer-id"
import type { Source, Target, Node, Bound, KeyValueStore, Entry } from "@canvas-js/okra"

import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"
import { Logger, logger } from "@libp2p/logger"
import { equals } from "uint8arrays"
import { bytesToHex as hex } from "@noble/hashes/utils"

import type { Message } from "@canvas-js/interfaces"
import { Signature, verifySignature } from "@canvas-js/signed-cid"

import { KEY_LENGTH, decodeId, decodeSignedMessage, encodeId, encodeSignedMessage, getClock } from "./schema.js"
import { Driver } from "./sync/driver.js"
import { Awaitable, assert, nsidPattern, cborNull } from "./utils.js"

export interface ReadOnlyTransaction {
	messages: Omit<KeyValueStore, "set" | "delete"> & Source
	parents: Omit<KeyValueStore, "set" | "delete">
}

export interface ReadWriteTransaction {
	messages: KeyValueStore & Target
	parents: KeyValueStore
}

export interface MessageLogInit<Payload = unknown, Result = void> {
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

export type MessageLogEvents<Payload, Result> = {
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

export abstract class AbstractMessageLog<Payload = unknown, Result = unknown> extends EventEmitter<
	MessageLogEvents<Payload, Result>
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
	public readonly apply: (id: string, signature: Signature | null, message: Message<Payload>) => Awaitable<Result>
	public readonly validate: (payload: unknown) => payload is Payload

	public readonly signatures: boolean
	public readonly sequencing: boolean

	protected readonly log: Logger
	protected readonly mempool = new Mempool<Payload>()

	protected constructor(init: MessageLogInit<Payload, Result>) {
		super()
		assert(nsidPattern.test(init.topic), "invalid topic (must match [a-zA-Z0-9\\.\\-]+)")

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
			AbstractMessageLog.bound(lowerBound?.id, lowerBound?.inclusive),
			AbstractMessageLog.bound(upperBound?.id, upperBound?.inclusive),
			options
		)) {
			const [recoveredKey, signature, message] = this.decode(value)
			assert(equals(recoveredKey, key), "expected equals(recoveredKey, key)")
			yield [decodeId(key), signature, message]
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

	public async getClock(): Promise<[clock: number, parents: string[]]> {
		if (this.sequencing === false) {
			return [0, []]
		}

		const parents = await this.read((txn) => this.getParents(txn))
		const clock = getClock(parents)
		return [clock, parents.map(decodeId)]
	}

	public async get(id: string): Promise<[signature: Signature | null, message: Message<Payload> | null]> {
		const key = encodeId(id)
		assert(key.length === KEY_LENGTH, "invalid id")

		const value = await this.read(({ messages }) => messages.get(key))
		if (value === null) {
			return [null, null]
		}

		const [recoveredKey, signature, message] = this.decode(value)
		assert(equals(recoveredKey, key), "invalid message key")
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
		const signer = options.signer ?? AbstractMessageLog.defaultSigner

		const { id, signature, message, result, root } = await this.write(async (txn) => {
			const parents = await this.getParents(txn)
			const clock = this.sequencing ? getClock(parents) : 0

			const message: Message<Payload> = { clock, parents: parents.map(decodeId), payload }
			const signature = await signer.sign(message)
			const [key, value] = this.encode(signature, message)

			const id = decodeId(key)
			this.log("appending message %s", id)
			const result = await this.#apply(txn, id, signature, message, [key, value])
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

			await this.#apply(txn, id, signature, message, [key, value])
			const root = await txn.messages.getRoot()
			return { id, root }
		})

		if (root !== undefined) {
			this.dispatchEvent(new CustomEvent("commit", { detail: { topic: this.topic, root } }))
			this.log("commited root %s", hex(root.hash))
		}

		return { id }
	}

	async #apply(
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

			const children = this.mempool.children.get(id)
			this.log("%s has mempool children %o", id, children)
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
						await this.#apply(txn, childId, signature, message)
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
					const id = decodeId(key)

					const [recoveredKey, signature, message] = this.decode(value)

					assert(equals(key, recoveredKey), "invalid message key")

					if (this.signatures) {
						assert(signature !== null, "missing message signature")
						verifySignature(signature, message)
					}

					const existingMessage = await txn.messages.get(key)
					if (existingMessage === null) {
						await this.#apply(txn, id, signature, message, [key, value])
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
