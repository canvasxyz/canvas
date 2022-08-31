import assert from "node:assert"

import { ethers } from "ethers"
import * as cbor from "microcbor"

import type {
	Action,
	ActionArgument,
	Block,
	Chain,
	ChainId,
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

export async function* source<T>(iter: Iterable<T>) {
	for (const value of iter) yield value
}
