import { anySignal } from "any-signal"
import * as cbor from "@ipld/dag-cbor"

export const MISSING_PARENT = "MISSING_PARENT"

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
