import type { PeerId } from "@libp2p/interface"
import { anySignal } from "any-signal"
import * as cbor from "@ipld/dag-cbor"

import { lessThan } from "@canvas-js/okra"

export class SyncDeadlockError extends Error {}
export class SyncTimeoutError extends Error {}
export class SyncResourceError extends Error {}

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

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}
