import type { PeerId } from "@libp2p/interface-peer-id"

import { anySignal } from "any-signal"
import { varint } from "multiformats"

import { lessThan } from "@canvas-js/okra"

export const protocolPrefix = "/canvas/v0/store/"

export const keyPattern = /^(\/canvas\/v0\/store\/[a-zA-Z0-9:.-]+)\/peers$/

export function getClock(parents: Uint8Array[]) {
	let max = 1
	for (const parent of parents) {
		const [clock] = varint.decode(parent)
		if (clock > max) {
			max = clock
		}
	}

	return max
}

// keys are made by concatenating an unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly
export function getKey(clock: number, hash: Uint8Array): Uint8Array {
	const encodingLength = varint.encodingLength(clock)
	const key = new Uint8Array(20)
	varint.encodeTo(clock, key, 0)
	key.set(hash.subarray(0, key.byteLength - encodingLength), encodingLength)
	return key
}

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

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
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

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}
