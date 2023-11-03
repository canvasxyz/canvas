import { CID } from "multiformats/cid"
import solw3 from "@solana/web3.js"

import type { SolanaMessage, SolanaSessionData } from "./types"

export const getKey = (topic: string, chain: string, address: string) => `canvas:${topic}/${chain}:${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function validateSessionData(data: unknown): data is SolanaSessionData {
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

function validateSolanaMessage(message: unknown): message is SolanaMessage {
	try {
		const { address, chainId, uri, issuedAt, expirationTime, ...otherValues } = message as Record<string, any>
		if (Object.keys(otherValues).length !== 0) {
			return false
		}
		return (
			typeof address === "string" &&
			typeof chainId === "string" &&
			typeof uri === "string" &&
			typeof issuedAt === "string" &&
			(expirationTime === null || typeof expirationTime === "string")
		)
	} catch {
		return false
	}
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export const chainPattern = /^solana:([a-zA-Z0-9]+)$/

export function parseChainId(chain: string): string {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export function getSessionURI(chain: string, publicKey: Uint8Array) {
	const pk = new solw3.PublicKey(publicKey)
	const sessionAddress = pk.toBase58()
	return `${chain}:${sessionAddress}`
}
