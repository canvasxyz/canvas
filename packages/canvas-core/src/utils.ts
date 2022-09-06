import assert from "node:assert"

import { ethers } from "ethers"
import * as cbor from "microcbor"
import Hash from "ipfs-only-hash"

import type {
	Action,
	ActionArgument,
	Block,
	Chain,
	ChainId,
	Model,
	ModelType,
	ModelValue,
	Session,
} from "@canvas-js/interfaces"
import { createHash } from "node:crypto"

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

export type BinaryBlock = {
	chain: Chain
	chainId: ChainId
	blocknum: number
	blockhash: Uint8Array
	timestamp: number
}

export type BinaryAction = {
	type: "action"
	signature: Uint8Array
	session: Uint8Array | null
	payload: {
		call: string
		args: ActionArgument[]
		from: Uint8Array
		spec: string
		timestamp: number
		block?: BinaryBlock
	}
}

export type BinarySession = {
	type: "session"
	signature: Uint8Array
	payload: {
		from: Uint8Array
		spec: string
		timestamp: number
		address: Uint8Array
		duration: number
		block?: BinaryBlock
	}
}

const toBinaryBlock = (block: Block): BinaryBlock => ({
	...block,
	blockhash: ethers.utils.arrayify(block.blockhash),
})

const fromBinaryBlock = (binaryBlock: BinaryBlock): Block => ({
	...binaryBlock,
	blockhash: ethers.utils.hexlify(binaryBlock.blockhash),
})

const toBinarySession = (session: Session): BinarySession => ({
	type: "session",
	signature: ethers.utils.arrayify(session.signature),
	payload: {
		...session.payload,
		from: ethers.utils.arrayify(session.payload.from),
		address: ethers.utils.arrayify(session.payload.address),
		block: session.payload.block && toBinaryBlock(session.payload.block),
	},
})

const fromBinarySession = (binarySession: BinarySession): Session => ({
	signature: ethers.utils.hexlify(binarySession.signature),
	payload: {
		...binarySession.payload,
		from: ethers.utils.hexlify(binarySession.payload.from),
		address: ethers.utils.hexlify(binarySession.payload.address),
		block: binarySession.payload.block && fromBinaryBlock(binarySession.payload.block),
	},
})

const toBinaryAction = (action: Action): BinaryAction => ({
	type: "action",
	signature: ethers.utils.arrayify(action.signature),
	session: action.session === null ? null : ethers.utils.arrayify(action.session),
	payload: {
		...action.payload,
		from: ethers.utils.arrayify(action.payload.from),
		block: action.payload.block && toBinaryBlock(action.payload.block),
	},
})

const fromBinaryAction = (binaryAction: BinaryAction): Action => ({
	signature: ethers.utils.hexlify(binaryAction.signature),
	session: binaryAction.session === null ? null : ethers.utils.hexlify(binaryAction.session),
	payload: {
		...binaryAction.payload,
		from: ethers.utils.hexlify(binaryAction.payload.from),
		block: binaryAction.payload.block && fromBinaryBlock(binaryAction.payload.block),
	},
})

export function encodeAction(action: Action): Uint8Array {
	const binaryAction = toBinaryAction(action)
	return cbor.encode(binaryAction)
}

export function decodeAction(data: Uint8Array): Action {
	const binaryAction = cbor.decode(data) as BinaryAction
	return fromBinaryAction(binaryAction)
}

export function encodeSession(session: Session): Uint8Array {
	const binarySession = toBinarySession(session)
	return cbor.encode(binarySession)
}

export function decodeSession(data: Uint8Array): Session {
	const binarySession = cbor.decode(data) as BinarySession
	return fromBinarySession(binarySession)
}

export async function getActionHash(action: Action): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of cbor.encodeStream(source([action]))) {
		hash.update(chunk)
	}

	return ethers.utils.hexlify(hash.digest())
}

export async function getSessionhash(session: Session): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of cbor.encodeStream(source([session]))) {
		hash.update(chunk)
	}

	return ethers.utils.hexlify(hash.digest())
}

export async function* source<T>(iter: Iterable<T>) {
	for (const value of iter) yield value
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
}

export async function compileSpec<Models extends Record<string, Model>>(exports: {
	models: Models
	actions: Record<string, (this: Context<Models>, ...args: ActionArgument[]) => void>
	routes?: Record<string, string>
}): Promise<{ name: string; spec: string }> {
	const { models, actions, routes } = exports

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
