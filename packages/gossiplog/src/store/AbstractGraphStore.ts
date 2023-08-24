import type { PeerId } from "@libp2p/interface-peer-id"
import type { Source, Target, Node } from "@canvas-js/okra"

import { logger } from "@libp2p/logger"
import * as cbor from "@ipld/dag-cbor"
import { base32 } from "multiformats/bases/base32"
import { equals } from "uint8arrays"

import type { Message, SignedMessage } from "@canvas-js/interfaces"
import { Signature, verifySignature } from "@canvas-js/signed-cid"

import { Driver } from "../sync/driver.js"
import { ReferenceSet } from "../graph.js"
import { decodeSignedMessage, encodeSignedMessage } from "../schema.js"
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

export interface GraphStoreInit {
	topic: string
	location: string | null
}

export abstract class AbstractGraphStore {
	abstract close(): Promise<void>

	abstract source(targetPeerId: PeerId, callback: (txn: ReadOnlyTransaction) => Promise<void>): Promise<void>
	abstract target(sourcePeerId: PeerId, callback: (txn: ReadWriteTransaction) => Promise<void>): Promise<void>

	abstract read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T>
	abstract write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T>

	protected readonly log = logger("canvas:gossiplog:store")

	protected constructor(init: GraphStoreInit) {}

	public async get(key: Uint8Array): Promise<SignedMessage | null> {
		const value = await this.read(async (txn) => txn.get(key))
		if (value === null) {
			return null
		}

		const [recoveredKey, signature, message] = decodeSignedMessage(value)
		assert(equals(recoveredKey, key), "invalid message key")
		return { signature, message }
	}

	public async add(signature: Signature, message: Message): Promise<{ key: Uint8Array; root: Node }> {
		const [key, value] = encodeSignedMessage({ signature, message })
		const { root } = await this.write(async (txn) => {
			const userdata = await txn.getUserdata()
			const references = new ReferenceSet(userdata && cbor.decode(userdata))

			await txn.set(key, value)
			references.update(key, message)

			await txn.setUserdata(cbor.encode(references.getParents()))
			const root = await txn.getRoot()
			return { root }
		})

		return { key, root }
	}

	public async sync(
		peerId: PeerId,
		source: Source,
		callback: (key: Uint8Array, signature: Signature, message: Message) => Promise<void>
	): Promise<{ root: Node }> {
		let root: Node | null = null

		await this.target(peerId, async (target) => {
			const userdata = await target.getUserdata()
			const references = new ReferenceSet(userdata && cbor.decode<Uint8Array[]>(userdata))

			const driver = new Driver(source, target)
			for await (const [key, value] of driver.sync()) {
				const id = base32.baseEncode(key)
				let signedMessage: SignedMessage | null = null

				try {
					const [recoveredKey, signature, message] = decodeSignedMessage(value)
					assert(equals(key, recoveredKey), "invalid message key")
					signedMessage = { signature, message }
				} catch (err) {
					this.log.error("failed to decode signed message %s: %O", id, err)
					continue
				}

				const { signature, message } = signedMessage

				try {
					verifySignature(signature, message)
				} catch (err) {
					this.log.error("invalid signature for message %s: %O", id, err)
					continue
				}

				try {
					await callback(key, signature, message)
				} catch (err) {
					this.log.error("failed to apply message %s: %O", id, err)
					continue
				}

				await target.set(key, value)
				references.update(key, message)
			}

			await target.setUserdata(cbor.encode(references.getParents()))
			root = await target.getRoot()
		})

		assert(root !== null, "internal error - sync exited prematurely")
		return { root }
	}
}
