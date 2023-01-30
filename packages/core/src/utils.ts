import assert from "node:assert"

import Hash from "ipfs-only-hash"
import { CID } from "multiformats"

import type {
	ActionArgument,
	Chain,
	ChainId,
	Model,
	ModelType,
	ModelValue,
	RouteContext,
	Query,
} from "@canvas-js/interfaces"

import { configure } from "safe-stable-stringify"

export const stringify = configure({ bigint: false, circularValue: Error, strict: true, deterministic: true })

export const ipfsURIPattern = /^ipfs:\/\/([a-zA-Z0-9]+)$/

export function parseIPFSURI(uri: string): CID | null {
	const match = ipfsURIPattern.exec(uri)
	if (match) {
		const [_, cid] = match
		return CID.parse(cid)
	} else {
		return null
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

type ValueTypes = {
	boolean: boolean
	string: string
	float: number
	integer: number
	datetime: number
}

type Values<M extends Model> = { [K in Exclude<keyof M, "indexes" | "id" | "updated_at">]: ValueTypes[M[K]] }
type Context<Models extends Record<string, Model>> = {
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

type ActionHandler<Models extends Record<string, Model>> = (
	args: Record<string, ActionArgument>,
	ctx: Context<Models>
) => void

// this is used for both `actions` and `sources`
function compileActionHandlers<Models extends Record<string, Model>>(actions: Record<string, ActionHandler<Models>>) {
	const entries = Object.entries(actions).map(([name, action]) => {
		assert(typeof action === "function")
		const source = action.toString()
		if (source.startsWith(`${name}(`) || source.startsWith(`async ${name}(`)) {
			return source
		} else {
			return `${name}: ${source}`
		}
	})

	return entries
}

export async function compileSpec<Models extends Record<string, Model>>(exports: {
	name: string
	models: Models
	actions: Record<string, ActionHandler<Models>>
	routes?: Record<string, (params: Record<string, string>, db: RouteContext) => Query>
	contracts?: Record<string, { chain: Chain; chainId: ChainId; address: string; abi: string[] }>
	sources?: Record<string, Record<string, ActionHandler<Models>>>
}): Promise<{ app: string; spec: string; appName: string }> {
	const { name, models, actions, routes, contracts, sources } = exports

	const appName = name || "Canvas App"

	const actionEntries = compileActionHandlers(actions)

	const routeEntries = Object.entries(routes || {}).map(([name, route]) => {
		assert(typeof route === "function")
		const source = route.toString()
		if (source.startsWith(`${name}(`) || source.startsWith(`async ${name}(`)) return source
		return `\t"${name}": ${source}`
	})

	const lines = [
		`export const name = ${JSON.stringify(appName)};`,
		`export const models = ${JSON.stringify(models, null, "\t")};`,
		`export const actions = {\n${actionEntries.join(",\n")}};`,
	]

	if (routes !== undefined) {
		lines.push(`export const routes = {\n${routeEntries.join(",\n")}};`)
	}

	if (contracts !== undefined) {
		lines.push(`export const contracts = ${JSON.stringify(contracts, null, "\t")};`)
	}

	if (sources !== undefined) {
		lines.push(`export const sources = {`)
		for (const [uri, actions] of Object.entries(sources)) {
			const entries = compileActionHandlers(actions)
			lines.push(`\t["${uri}"]: {\n${entries.map((line) => `\t\t${line}`).join(",\n")}\n\t},`)
		}
		lines.push(`};`)
	}

	const spec = lines.join("\n")
	const cid = await Hash.of(spec)
	return { app: `ipfs://${cid}`, spec, appName }
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
