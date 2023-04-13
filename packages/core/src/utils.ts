import { CID } from "multiformats"

import AggregateError from "aggregate-error"
import { anySignal } from "any-signal"

import { ethers } from "ethers"
import { configure } from "safe-stable-stringify"
import { CodeError } from "@libp2p/interfaces/errors"

import chalk from "chalk"
import { TimeoutController } from "timeout-abort-controller"

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

export const getCustomActionSchemaName = (app: string, name: string) => `${app}?name=${name}`

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

export async function wait(interval: number, options: { signal?: AbortSignal }) {
	if (options.signal?.aborted) {
		return
	}

	const timeoutController = new TimeoutController(interval)
	const signal = anySignal([timeoutController.signal, options.signal])
	try {
		await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()))
	} finally {
		timeoutController.clear()
		signal.clear()
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

export async function retry<T>(
	f: () => Promise<T>,
	handleError: (err: Error, n: number) => void,
	{ interval, ...options }: { interval: number; signal?: AbortSignal; maxRetries?: number }
): Promise<T> {
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

function getErrorMessage(err: unknown): string {
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
