import type { PeerId } from "@libp2p/interface-peer-id"
import type { Source, Target, Node } from "@canvas-js/okra"

import { Logger, logger } from "@libp2p/logger"
import * as cbor from "@ipld/dag-cbor"
import { base32 } from "multiformats/bases/base32"
import { equals } from "uint8arrays"

import type { Message, SignedMessage } from "@canvas-js/interfaces"
import { Signature, verifySignature } from "@canvas-js/signed-cid"

import { Driver } from "../sync/driver.js"
import { decodeSignedMessage, getClock } from "../schema.js"
import { Awaitable, assert } from "../utils.js"

export interface ReadOnlyTransaction extends Target {
	get(key: Uint8Array): Awaitable<Uint8Array | null>
	getUserdata(): Awaitable<Uint8Array | null>
}

export interface ReadWriteTransaction extends ReadOnlyTransaction {
	set(key: Uint8Array, value: Uint8Array): Awaitable<void>
	delete(key: Uint8Array): Awaitable<void>
	setUserdata(userdata: Uint8Array | null): Awaitable<void>
}

export interface StoreInit {
	topic: string
	location: string | null

	signatures: boolean
	sequencing: boolean
}

export abstract class AbstractStore {
	abstract close(): Promise<void>

	abstract source(targetPeerId: PeerId, callback: (txn: ReadOnlyTransaction) => Promise<void>): Promise<void>
	abstract target(sourcePeerId: PeerId, callback: (txn: ReadWriteTransaction) => Promise<void>): Promise<void>

	abstract read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T>
	abstract write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T>

	protected readonly log: Logger

	protected constructor(private readonly init: StoreInit) {
		this.log = logger(`canvas:gossiplog:store`)
	}

	public async get(key: Uint8Array): Promise<[signature: Signature | null, message: Message | null]> {
		const value = await this.read(async (txn) => txn.get(key))
		if (value === null) {
			return [null, null]
		}

		const [recoveredKey, signature, message] = decodeSignedMessage(value, {
			sequencing: this.init.sequencing,
			signatures: this.init.signatures,
		})

		assert(equals(recoveredKey, key), "invalid message key")
		return [signature, message]
	}

	public async sync(
		peerId: PeerId,
		source: Source,
		callback: (key: Uint8Array, signature: Signature | null, message: Message) => Promise<void>
	): Promise<{ root: Node }> {
		let root: Node | null = null

		await this.target(peerId, async (target) => {
			const graph = await Graph.import(target)

			const driver = new Driver(source, target)
			for await (const [key, value] of driver.sync()) {
				const id = base32.baseEncode(key)
				let signedMessage: SignedMessage | null = null

				try {
					const [recoveredKey, signature, message] = decodeSignedMessage(value, {
						sequencing: this.init.sequencing,
						signatures: this.init.signatures,
					})

					assert(equals(key, recoveredKey), "invalid message key")
					signedMessage = { signature, message }
				} catch (err) {
					this.log.error("[%s] failed to decode signed message %s: %O", this.init.topic, id, err)
					continue
				}

				const { signature, message } = signedMessage

				if (this.init.signatures) {
					try {
						assert(signature !== null, "missing message signature")
						verifySignature(signature, message)
					} catch (err) {
						this.log.error("[%s] invalid signature for message %s: %O", this.init.topic, id, err)
						continue
					}
				}

				try {
					await callback(key, signature, message)
				} catch (err) {
					this.log.error("[%s] failed to apply message %s: %O", this.init.topic, id, err)
					continue
				}

				await target.set(key, value)
				graph.update(key, message)
			}

			await graph.save(target)
			root = await target.getRoot()
		})

		assert(root !== null, "internal error - sync exited prematurely")
		return { root }
	}
}

export class Graph {
	private readonly log = logger("canvas:gossiplog:graph")

	readonly #parents = new Set<string>()

	public static async import(txn: ReadOnlyTransaction): Promise<Graph> {
		const userdata = await txn.getUserdata()
		const parents = userdata === null ? [] : cbor.decode<Uint8Array[]>(userdata)
		return new Graph(parents)
	}

	constructor(parents: Uint8Array[]) {
		const clock = getClock(parents)
		this.log("created graph at clock %d with parents %o", clock, parents.map(base32.baseEncode))
		for (const key of parents) {
			this.#parents.add(base32.baseEncode(key))
		}
	}

	public async save(txn: ReadWriteTransaction) {
		const [clock, parents] = this.export()
		this.log("saving graph at clock %d with parents %o", clock, parents.map(base32.baseEncode))
		await txn.setUserdata(cbor.encode(parents))
	}

	public update(key: Uint8Array, message: Message) {
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

	public export(): [clock: number, parents: Uint8Array[]] {
		const parents = [...this.#parents].map(base32.baseDecode)
		const clock = getClock(parents)
		return [clock, parents]
	}
}
