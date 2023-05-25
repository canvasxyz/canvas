import { blake3 } from "@noble/hashes/blake3"
import { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { lessThan } from "@canvas-js/okra"

import { anySignal } from "any-signal"

export const keyPattern = /^(\/canvas\/v0\/store\/[a-zA-Z0-9:.-]+)\/peers$/

export function sortPair(a: PeerId, b: PeerId): [x: PeerId, y: PeerId] {
	const ab = blake3.create({ dkLen: 16 })
	ab.update(a.toBytes())
	ab.update(b.toBytes())

	const ba = blake3.create({ dkLen: 16 })
	ba.update(b.toBytes())
	ba.update(a.toBytes())

	if (lessThan(ab.digest(), ba.digest())) {
		return [a, b]
	} else {
		return [b, a]
	}
}

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export async function wait(interval: number, options: { signal: AbortSignal }) {
	if (options.signal.aborted) {
		return
	}

	const signal = anySignal([AbortSignal.timeout(interval), options.signal])
	await new Promise<void>((resolve) => {
		signal.addEventListener("abort", () => resolve())
	}).finally(() => signal.clear())
}

export class CacheMap<K, V> extends Map<K, V> {
	constructor(public readonly capacity: number, entries?: Iterable<[K, V]>) {
		super()
	}

	set(key: K, value: V) {
		super.set(key, value)
		for (const key of this.keys()) {
			if (this.size > this.capacity) {
				this.delete(key)
			} else {
				break
			}
		}

		return this
	}
}

export async function getPeerId(config: {
	getPrivateKey: () => Promise<string | null>
	setPrivateKey: (privateKey: string) => Promise<void>
}): Promise<PeerId> {
	const privateKey = await config.getPrivateKey()
	if (privateKey === null) {
		const peerId = await createEd25519PeerId()
		const privateKeyBytes = exportToProtobuf(peerId)
		const privateKey = base64.baseEncode(privateKeyBytes)
		await config.setPrivateKey(privateKey)
		return peerId
	} else {
		const privateKeyBytes = base64.baseDecode(privateKey)
		return await createFromProtobuf(privateKeyBytes)
	}
}

export type Entry = { key: Uint8Array; value: Uint8Array }

export function encodeEntry({ key, value }: Entry): Uint8Array {
	const buffer = new ArrayBuffer(4 + key.length + 4 + value.length)
	const array = new Uint8Array(buffer, 0, buffer.byteLength)
	const view = new DataView(buffer)
	view.setUint32(0, key.length)
	array.set(key, 4)
	view.setUint32(4 + key.length, value.length)
	array.set(value, 4 + key.length + 4)
	return array
}

export function decodeEntry(entry: Uint8Array): Entry {
	const view = new DataView(entry.buffer, entry.byteOffset, entry.byteLength)
	assert(entry.length >= 4, "invalid key/value entry")
	const keyLength = view.getUint32(0)
	assert(entry.length >= 4 + keyLength, "invalid key/value entry")
	const key = entry.subarray(4, 4 + keyLength)
	assert(entry.length >= 4 + keyLength + 4, "invalid key/value entry")
	const valueLength = view.getUint32(4 + keyLength)
	assert(entry.length === 4 + keyLength + 4 + valueLength, "invalid key/value entry")
	const value = entry.subarray(4 + keyLength + 4, 4 + keyLength + 4 + valueLength)
	return { key, value }
}

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}
