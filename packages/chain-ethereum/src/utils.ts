import { CID } from "multiformats/cid"
import * as siwe from "siwe"
import { computeAddress, hexlify } from "ethers"

import type { SIWESessionData, SIWEMessage } from "./types.js"

export const getKey = (topic: string, chain: string, address: string) => `canvas:${topic}/${chain}:${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateSessionData(data: unknown): data is SIWESessionData {
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

	const { signature, domain, nonce } = data as Record<string, any>
	return signature instanceof Uint8Array && typeof domain === "string" && typeof nonce === "string"
}

export const SIWEMessageVersion = "1"

export function prepareSIWEMessage(message: SIWEMessage): string {
	return new siwe.SiweMessage({
		version: message.version,
		domain: message.domain,
		nonce: message.nonce,
		address: message.address,
		uri: message.uri,
		chainId: message.chainId,
		issuedAt: message.issuedAt,
		expirationTime: message.expirationTime ?? undefined,
	}).prepareMessage()
}

export const chainPattern = /^eip155:(\d+)$/

export function parseChainId(chain: string): number {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return parseInt(chainId)
}

export function getSessionURI(chain: string, publicKey: Uint8Array) {
	const sessionAddress = computeAddress(hexlify(publicKey))
	return `${chain}:${sessionAddress}`
}
