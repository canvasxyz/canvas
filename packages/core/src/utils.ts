import assert from "node:assert"

import { ethers } from "ethers"
import Hash from "ipfs-only-hash"

import type { ActionArgument, Chain, ChainId, Model, ModelType, ModelValue } from "@canvas-js/interfaces"

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

type ValueTypes = {
	boolean: boolean
	string: string
	float: number
	integer: number
	datetime: number
}

type Values<M extends Model> = { [K in Exclude<keyof M, "indexes" | "id" | "updated_at">]: ValueTypes[M[K]] }

export type Context<Models extends Record<string, Model>> = {
	timestamp: number
	hash: string
	from: string
	db: {
		[K in keyof Models]: {
			set: (id: string, values: Values<Models[K]>) => void
			delete: (id: string) => void
		}
	}
	contracts: Record<string, Record<string, (...args: any[]) => Promise<any[]>>>
}

export async function compileSpec<Models extends Record<string, Model>>(exports: {
	models: Models
	actions: Record<string, (this: undefined, args: Record<string, ActionArgument>, ctx: Context<Models>) => void>
	routes?: Record<string, string>
	contracts?: Record<string, { chain: Chain; chainId: ChainId; address: string; abi: string[] }>
}): Promise<{ uri: string; spec: string }> {
	const { models, actions, routes, contracts } = exports

	const actionEntries = Object.entries(actions).map(([name, action]) => {
		const source = action.toString()
		assert(source.startsWith(`${name}(`) || source.startsWith(`async ${name}(`))
		return source
	})

	const lines = [
		`export const models = ${JSON.stringify(models)};`,
		`export const actions = {\n${actionEntries.join(",\n")}};`,
	]

	if (routes !== undefined) {
		lines.push(`export const routes = ${JSON.stringify(routes, null, "  ")};`)
	}

	if (contracts !== undefined) {
		lines.push(`export const contracts = ${JSON.stringify(contracts, null, "  ")};`)
	}

	const spec = lines.join("\n")
	const cid = await Hash.of(spec)
	return { uri: `ipfs://${cid}`, spec }
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
	options: { interval: number; signal: AbortSignal }
): Promise<T> {
	let n = 0
	while (true) {
		const result = await getResult(f)
		if (result.done) {
			return result.value
		} else if (options.signal.aborted) {
			throw result.value
		} else {
			handleError(result.value, n++)
			await wait(options)
		}
	}
}

export const toBuffer = (array: Uint8Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)

export function toHex(hash: Uint8Array | Buffer) {
	if (!Buffer.isBuffer(hash)) {
		hash = toBuffer(hash)
	}

	return `0x${hash.toString("hex")}`
}

export function fromHex(input: string) {
	assert(input.startsWith("0x"), 'input did not start with "0x"')
	return Buffer.from(input.slice(2), "hex")
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

export type BlockResolver = (chain: Chain, chainId: ChainId, blockhash: string) => Promise<ethers.providers.Block>
