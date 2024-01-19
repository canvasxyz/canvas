import type { PeerId } from "@libp2p/interface"
import { anySignal } from "any-signal"
import * as cbor from "@ipld/dag-cbor"

import { lessThan } from "@canvas-js/okra"

export const cborNull: Uint8Array = cbor.encode(null)

// eslint-disable-next-line no-useless-escape
export const topicPattern = /^[a-zA-Z0-9\.\-]+$/

/** Logarithmic clock decay */
export function* getAncestorClocks(clock: number): Iterable<number> {
	let i = 0
	while (true) {
		const ancestor = clock - (1 << i++)
		if (ancestor > 0) {
			yield ancestor
		} else {
			break
		}
	}
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

export async function collect<I, O = I>(iter: AsyncIterable<I>, map?: (value: I) => O): Promise<O[]> {
	const values: O[] = []
	for await (const value of iter) {
		if (map === undefined) {
			values.push(value as O)
		} else {
			values.push(map(value))
		}
	}
	return values
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

export class DelayableController {
	#interval: number
	#controller: AbortController
	#timer: ReturnType<typeof setTimeout>
	signal: AbortSignal

	constructor(interval: number) {
		this.#interval = interval
		this.#controller = new AbortController()
		this.signal = this.#controller.signal
		this.#timer = setTimeout(() => {
			this.#controller.abort()
		}, this.#interval)
	}
	delay() {
		clearTimeout(this.#timer)
		this.#timer = setTimeout(() => {
			this.#controller.abort()
		}, this.#interval)
	}
}

// add elements with CacheMap.add(key, value) and they'll
// get shifted out in the order they were added.

export class CacheMap<K, V> extends Map<K, V> {
	constructor(
		public readonly capacity: number,
		entries?: Iterable<[K, V]>,
	) {
		super()

		for (const [key, value] of entries ?? []) {
			this.set(key, value)
		}
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
