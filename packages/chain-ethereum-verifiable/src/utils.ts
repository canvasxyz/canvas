import { CID } from "multiformats/cid"
import * as siwe from "siwe"

import type { SIWESessionData, SIWEMessage, EIP712VerifiableSessionMessage } from "./types.js"
import { Session } from "@canvas-js/interfaces"

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateSessionData(authorizationData: unknown): authorizationData is SIWESessionData {
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

export function prepareEIP712SessionMessage(message: Session) {
	// ???

	return {
		types: {
			EIP712Domain: [
				{ name: "name", type: "string" }, // name should be exactly equal to the topic of the session
				{ name: "version", type: "string" },
				{ name: "chainId", type: "uint256" },
				{ name: "verifyingContract", type: "address" },
				{ name: "salt", type: "bytes32" },
			],
			Session: [
				{ name: "address", type: "address" }, // the address that is delegated-signing the action
				{ name: "publicKey", type: "address" }, // the burner address that is being authorized to sign actions
				{ name: "blockhash", type: "string" }, // may be "" if no blockhash
				{ name: "timestamp", type: "uint256" }, // this is actually overkill at uint24 is enough, but we can revisit during code review
				{ name: "duration", type: "uint256" },
			],
		},
		primaryType: "Session",
		domain: {
			// these are the signer fields
		},
		message: {
			address: message.address,
			publicKey: message.publicKey,
			blockhash: message.blockhash,
			timestamp: message.timestamp,
			duration: message.duration,
		},
	}
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
