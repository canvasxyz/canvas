import assert from "node:assert"

import Hash from "ipfs-only-hash"

import { CID } from "multiformats/cid"
import * as raw from "multiformats/codecs/raw"
import { identity } from "multiformats/hashes/identity"

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

type Values<M extends Model> = { [K in Exclude<keyof M, "indexes">]: ValueTypes[M[K]] }

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
	actions: Record<string, (this: Context<Models>, ...args: ActionArgument[]) => void>
	routes?: Record<string, string>
	contracts?: Record<string, { chain: Chain; chainId: ChainId; address: string; abi: string[] }>
}): Promise<{ name: string; spec: string }> {
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
		lines.push(`export const database = "sqlite";`)
		lines.push(`export const routes = ${JSON.stringify(routes, null, "  ")};`)
	}

	if (contracts !== undefined) {
		lines.push(`export const contracts = ${JSON.stringify(contracts, null, "  ")};`)
	}

	const spec = lines.join("\n")
	const name = await Hash.of(spec)
	return { name, spec }
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

export const bootstrapList = [
	"/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
	"/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
	"/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
	"/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp",
	"/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
	"/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
	// "/dns4/node0.preload.ipfs.io/tcp/443/wss/p2p/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic",
	// "/dns4/node1.preload.ipfs.io/tcp/443/wss/p2p/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6",
	// "/dns4/node2.preload.ipfs.io/tcp/443/wss/p2p/QmV7gnbW5VTcJ3oyM2Xk1rdFBJ3kTkvxc87UFGsun29STS",
	// "/dns4/node3.preload.ipfs.io/tcp/443/wss/p2p/QmY7JB6MQXhxHvq7dBDh4HpbH29v4yE9JRadAVpndvzySN",
]

export const getProtocol = (cid: CID) => `/x/canvas/${cid.toString()}`
export const getTopic = (cid: CID) => `canvas:${cid.toString()}`

export function getRendezvousCID(cid: CID) {
	const data = Buffer.from(getTopic(cid), "utf-8")
	return CID.createV1(raw.code, identity.digest(raw.encode(data)))
}

export const wait = (options: { delay: number; signal: AbortSignal }) =>
	new Promise<void>((resolve, reject) => {
		let timeout: NodeJS.Timeout | undefined = undefined

		const abort = (event: Event) => {
			clearTimeout(timeout)
			reject(event)
		}

		options.signal.addEventListener("abort", abort)
		timeout = setTimeout(() => {
			options.signal.removeEventListener("abort", abort)
			resolve()
		}, options.delay)
	})

// const retry = (
// 	f: (signal: AbortSignal) => Promise<void>,
// 	options: { signal: AbortSignal; delay: number }
// ): AsyncIterable<any> => ({
// 	[Symbol.asyncIterator]() {
// 		let n = 0
// 		return {
// 			next() {
// 				if (options.signal.aborted) {
// 					return Promise.resolve({ done: true, value: undefined })
// 				}

// 				const next = n++ === 0 ? f(options.signal) : wait(options).then(() => f(options.signal))
// 				return next
// 					.then(() => ({ done: true, value: undefined }))
// 					.catch((err) => {
// 						if (err instanceof Event && err.type === "abort" && options.signal.aborted) {
// 							return { done: true, value: undefined }
// 						} else {
// 							return { done: false, value: err }
// 						}
// 					})
// 			},
// 		}
// 	},
// })

export async function retry<T>(
	f: (signal: AbortSignal) => Promise<T>,
	handleError: (err: any, n: number) => void,
	options: { signal: AbortSignal; delay: number }
): Promise<T> {
	let n = 0
	while (true) {
		const result: IteratorResult<any, T> = await f(options.signal)
			.then((value) => ({ done: true, value }))
			.catch((err) => ({ done: false, value: err }))

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
