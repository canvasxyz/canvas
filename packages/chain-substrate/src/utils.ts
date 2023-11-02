import { CID } from "multiformats/cid"

import type { SubstrateSessionData } from "./types"
import { encodeAddress } from "@polkadot/util-crypto"

export const getKey = (topic: string, chain: string, address: string) => `canvas:${topic}/${chain}:${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function validateSessionData(data: unknown): data is SubstrateSessionData {
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

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export const chainPattern = /^polkadot:([a-f0-9]+)$/

export function parseChainId(chain: string): string {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export function getSessionURI(chain: string, publicKey: Uint8Array) {
	const sessionAddress = encodeAddress(publicKey)
	return `${chain}:${sessionAddress}`
}
