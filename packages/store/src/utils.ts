import { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { anySignal } from "any-signal"

export const keyPrefix = "/canvas/v0/store/"
export const keyPattern = /^(\/canvas\/v0\/store\/[a-zA-Z0-9:.-]+)\/peers$/

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

export async function retry<T>(
	f: () => Promise<T>,
	handleError: (err: Error, n: number) => void,
	{ interval, ...options }: { interval: number; signal: AbortSignal; maxRetries?: number }
): Promise<T | void> {
	const maxRetries = options.maxRetries ?? Infinity

	for (let n = 0; n < maxRetries; n++) {
		const result = await getResult(f)
		if (result.done) {
			return result.value
		} else if (options.signal?.aborted) {
			throw result.value
		} else {
			handleError(result.value, n)
			await wait(interval, options)
		}
	}
}

async function getResult<T>(f: () => Promise<T>): Promise<IteratorResult<Error, T>> {
	try {
		const value = await f()
		return { done: true, value }
	} catch (err) {
		if (err instanceof Error) {
			return { done: false, value: err }
		} else {
			throw err
		}
	}
}

export class CacheMap<K, V> extends Map<K, V> {
	constructor(public readonly capacity: number, entries?: Iterable<[K, V]>) {
		super()
	}

	add(key: K, value: V) {
		this.set(key, value)
		for (const key of this.keys()) {
			if (this.size > this.capacity) {
				this.delete(key)
			} else {
				break
			}
		}
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
	const array = new Uint8Array()
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
