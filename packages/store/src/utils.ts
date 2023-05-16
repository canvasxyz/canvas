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
