import { CID } from "multiformats/cid"

import type { SolanaSessionData } from "./types.js"

export const addressPattern =
	/^(solana:[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32}):([123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)$/

export function parseAddress(address: string): [chainId: string, walletAddress: string] {
	const result = addressPattern.exec(address)
	if (result === null) {
		throw new Error(`expected address to match ${addressPattern}`)
	}

	const [_, chainId, walletAddress] = result
	return [chainId, walletAddress]
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
