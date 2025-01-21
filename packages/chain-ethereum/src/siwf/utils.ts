import { CID } from "multiformats/cid"
import * as siwe from "siwe"

import { assert } from "@canvas-js/utils"
import type { SIWFSessionData, SIWFMessage } from "./types.js"

export function validateSIWFSessionData(authorizationData: unknown): authorizationData is SIWFSessionData {
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

	const {
		custodyAddress,
		fid,
		signature,
		siweDomain,
		siweUri,
		siweNonce,
		siweVersion,
		siweChainId,
		siweIssuedAt,
		siweExpirationTime,
		siweNotBefore,
	} = authorizationData as Record<string, any>
	return (
		signature instanceof Uint8Array &&
		typeof custodyAddress === "string" &&
		typeof fid === "string" &&
		typeof siweUri === "string" &&
		typeof siweDomain === "string" &&
		typeof siweNonce === "string" &&
		typeof siweVersion === "string" &&
		typeof siweChainId === "number" &&
		typeof siweIssuedAt === "string" &&
		(typeof siweExpirationTime === "string" || siweExpirationTime === null) &&
		(typeof siweNotBefore === "string" || siweNotBefore === null)
	)
}

export const addressPattern = /^did:pkh:eip155:(\d+):(0x[a-fA-F0-9]+)$/

export function parseAddress(address: string): { chainId: number; address: `0x${string}` } {
	const result = addressPattern.exec(address)
	assert(result !== null)
	const [_, chainIdResult, addressResult] = result
	return { chainId: parseInt(chainIdResult), address: addressResult as `0x${string}` }
}
