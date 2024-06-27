import { CID } from "multiformats/cid"
import * as siwe from "siwe"

import { assert } from "@canvas-js/utils"
import type { SIWESessionData, SIWEMessage, EIP712AuthorizationData } from "./types.js"

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
		resources: message.resources,
	}).prepareMessage()
}

export const addressPattern = /^did:pkh:eip155:(\d+):(0x[a-fA-F0-9]+)$/

export function parseAddress(address: string): { chainId: number; address: `0x${string}` } {
	const result = addressPattern.exec(address)
	assert(result !== null)
	const [_, chainIdResult, addressResult] = result
	return { chainId: parseInt(chainIdResult), address: addressResult as `0x${string}` }
}
