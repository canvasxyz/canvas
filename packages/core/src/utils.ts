import { CID } from "multiformats"

import { ethers } from "ethers"
import { configure } from "safe-stable-stringify"

import type { ModelType, ModelValue } from "@canvas-js/interfaces"

const { hexlify, arrayify } = ethers.utils

export const stringify = configure({ bigint: false, circularValue: Error, strict: true, deterministic: true })

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const ipfsURIPattern = /^ipfs:\/\/([a-zA-Z0-9]+)$/

export function parseIPFSURI(uri: string): CID {
	const match = ipfsURIPattern.exec(uri)
	if (match) {
		const [_, cid] = match
		return CID.parse(cid)
	} else {
		throw new Error("invalid ipfs:// URI")
	}
}

export type JSONValue = null | string | number | boolean | JSONArray | JSONObject
export interface JSONArray extends Array<JSONValue> {}
export interface JSONObject {
	[key: string]: JSONValue
}

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (key: K, value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K, value)])) as Record<K, T>

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateType(type: ModelType, value: ModelValue) {
	if (type === "boolean") {
		assert(typeof value === "boolean", "invalid type: expected boolean")
	} else if (type === "string") {
		assert(typeof value === "string", "invalid type: expected string")
	} else if (type === "integer") {
		assert(Number.isSafeInteger(value), "invalid type: expected integer")
	} else if (type === "float") {
		assert(typeof value === "number", "invalid type: expected number")
	} else if (type === "datetime") {
		assert(typeof value === "number", "invalid type: expected number")
	} else {
		signalInvalidType(type)
	}
}

export class AbortError extends Error {
	constructor(readonly event: Event) {
		super("Received abort signal")
	}
}

export async function wait(options: { interval: number; signal: AbortSignal }) {
	await new Promise<void>((resolve, reject) => {
		let timeout: NodeJS.Timeout | undefined = undefined

		const abort = (event: Event) => {
			clearTimeout(timeout)
			reject(new AbortError(event))
		}

		options.signal.addEventListener("abort", abort)
		timeout = setTimeout(() => {
			options.signal.removeEventListener("abort", abort)
			resolve()
		}, options.interval)
	})
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
	options: { interval: number; signal: AbortSignal; maxRetries?: number }
): Promise<T> {
	const maxRetries = options.maxRetries ?? Infinity

	for (let n = 0; n < maxRetries; n++) {
		const result = await getResult(f)
		if (result.done) {
			return result.value
		} else if (options.signal.aborted) {
			throw result.value
		} else {
			handleError(result.value, n)
			await wait(options)
		}
	}

	throw new Error("exceeded max retries")
}

export function toHex(hash: Uint8Array) {
	return hexlify(hash)
}

export function fromHex(input: string) {
	return arrayify(input)
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
