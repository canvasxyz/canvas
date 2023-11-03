import { CID } from "multiformats/cid"
import { CosmosSessionData } from "./types"
import { toBech32 } from "@cosmjs/encoding"

export const getKey = (topic: string, chain: string, address: string) => `canvas:${topic}/${chain}:${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const chainPattern = /^cosmos:([-a-zA-Z0-9_]{1,32})$/

export function parseChainId(chain: string): string {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}
export function validateSessionData(data: unknown): data is CosmosSessionData {
	if (data === undefined || data === null) {
		return false
	} else if (typeof data === "boolean" || typeof data === "number" || typeof data === "string") {
		return false
	} else if (CID.asCID(data) !== null) {
		return false
	} else if (data instanceof Uint8Array) {
		return false
	} else if (Array.isArray(data)) {
		return false
	}

	const { signature } = data as Record<string, any>
	if (!signature) {
		return false
	}

	return signature instanceof Uint8Array
}

export function getSessionURI(prefix: string, chain: string, publicKey: Uint8Array) {
	const sessionAddress = toBech32(prefix, publicKey)
	return `${chain}:${sessionAddress}`
}
