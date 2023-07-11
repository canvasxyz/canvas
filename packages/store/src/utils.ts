import { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { lessThan } from "@canvas-js/okra"

import { anySignal } from "any-signal"

export const keyPattern = /^(\/canvas\/v0\/store\/[a-zA-Z0-9:.-]+)\/peers$/

export function sortPair(a: PeerId, b: PeerId): [x: PeerId, y: PeerId] {
	if (lessThan(a.multihash.digest, b.multihash.digest)) {
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

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}

// const timestampBuffer = new ArrayBuffer(8)
// const timestampView = new DataView(timestampBuffer)

// export function encodeTimestamp(timestamp: number): Uint8Array {
// 	timestampView.setBigUint64(0, BigInt(timestamp))
// 	return new Uint8Array(timestampBuffer, 2, 6)
// }
