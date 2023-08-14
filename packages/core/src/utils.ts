import chalk from "chalk"
import AggregateError from "aggregate-error"
import { anySignal } from "any-signal"
import { configure } from "safe-stable-stringify"
import { CodeError } from "@libp2p/interfaces/errors"
import { bytesToHex } from "@noble/hashes/utils"

export const stringify = configure({ bigint: false, circularValue: Error, strict: true, deterministic: true })

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (entry: [key: K, value: S]) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>

export const mapKeys = <K extends string, S, T>(object: Record<K, S>, map: (key: K) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K)])) as Record<K, T>

export const mapValues = <K extends string, S, T>(object: Record<K, S>, map: (value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(value)])) as Record<K, T>

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export async function wait(interval: number, options: { signal?: AbortSignal }) {
	if (options.signal?.aborted) {
		return
	}

	const signal = anySignal([AbortSignal.timeout(interval), options.signal])
	await new Promise<void>((resolve) => {
		signal.addEventListener("abort", () => resolve())
	}).finally(() => signal.clear())
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

export async function retry<T>(
	f: () => Promise<T>,
	handleError: (err: Error, n: number) => void,
	{ interval, ...options }: { interval: number; signal?: AbortSignal; maxRetries?: number }
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

// add elements with CacheMap.add(key, value) and they'll
// get shifted out in the order they were added.
export class CacheMap<K, V> extends Map<K, V> {
	constructor(public readonly capacity: number) {
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

export function logErrorMessage(prefix: string, context: string, err: unknown) {
	if (err instanceof Error && err.name === "AggregateError") {
		const { errors } = err as AggregateError
		if (errors.length === 1) {
			const [err] = errors
			console.log(prefix, context, chalk.yellow(`(${getErrorMessage(err)})`))
		} else {
			console.log(prefix, context, chalk.yellow(`(${errors.length} errors)`))
			for (const err of errors) {
				console.log(prefix, chalk.yellow(`- ${getErrorMessage(err)}`))
			}
		}
	} else {
		console.log(prefix, context, chalk.yellow(`(${getErrorMessage(err)})`))
	}
}

export function getErrorMessage(err: unknown): string {
	if (err instanceof Error && err.name === "AggregateError") {
		const { errors } = err as AggregateError
		return errors.map(getErrorMessage).join("; ")
	} else if (err instanceof CodeError) {
		return `${err.code}: ${err.message}`
	} else if (err instanceof Error) {
		return `${err.name}: ${err.message}`
	} else {
		throw err
	}
}

const timestampBuffer = new ArrayBuffer(8)
const timestampView = new DataView(timestampBuffer)

export function encodeTimestampVersion(timestamp: number): string {
	timestampView.setBigUint64(0, BigInt(timestamp))
	return bytesToHex(new Uint8Array(timestampBuffer, 2, 6))
}

export function compareTimestampVersion(versionA: string, versionB: string): -1 | 0 | 1 {
	return versionA < versionB ? -1 : versionB < versionA ? 1 : 0
}
