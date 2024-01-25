import { CID } from "multiformats/cid"
import * as siwe from "siwe"

import type { SIWESessionData, SIWEMessage } from "./types.js"

export const SECONDS = 1000
export const MINUTES = 60 * SECONDS
export const HOURS = 60 * MINUTES
export const DAYS = 24 * HOURS

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateSIWESessionData(authorizationData: unknown): authorizationData is SIWESessionData {
	if (authorizationData === undefined || authorizationData === null) {
		return false
	} else if (
		typeof authorizationData === "boolean" ||
		typeof authorizationData === "number" ||
		typeof authorizationData === "string"
	) {
		return false
	} else if (CID.asCID(authorizationData) !== null) {
		return false
	} else if (authorizationData instanceof Uint8Array) {
		return false
	} else if (Array.isArray(authorizationData)) {
		return false
	}

	const { signature, domain, nonce } = authorizationData as Record<string, any>
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

export const addressPattern = /^eip155:(\d+):(0x[A-Fa-f0-9]+)$/

export function parseAddress(address: string): [chain: number, walletAddress: string] {
	const result = addressPattern.exec(address)
	if (result === null) {
		throw new Error(`invalid address: ${address} did not match ${addressPattern}`)
	}

	const [_, chain, walletAddress] = result
	return [parseInt(chain), walletAddress]
}
