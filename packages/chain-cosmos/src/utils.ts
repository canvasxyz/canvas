import { CosmosMessage, CosmosSessionData } from "./types"
import { toBech32 } from "@cosmjs/encoding"

export const getKey = (topic: string, address: string) => `canvas/${topic}/${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const addressPattern = /^cosmos:([0-9a-z\-_]+):([a-zA-Fa-f0-9]+)$/

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}
export function validateSessionData(data: unknown): data is CosmosSessionData {
	try {
		const signatureType = (data as CosmosSessionData).signatureType
		if (signatureType == "amino") {
			// validate amino
			const { signature, pub_key, chain_id } = (data as any).signature
			if (!(signature instanceof Uint8Array) || typeof pub_key !== "object") {
				return false
			}
			const { type, value } = pub_key
			if (typeof type !== "string" || !(value instanceof Uint8Array)) {
				return false
			}
		} else if (signatureType == "bytes") {
			// validate bytes
			const { signature, pub_key, chain_id } = (data as any).signature
			if (!(signature instanceof Uint8Array) || typeof pub_key !== "object") {
				return false
			}
			const { type, value } = pub_key
			if (typeof type !== "string" || !(value instanceof Uint8Array)) {
				return false
			}
		} else if (signatureType == "ethereum") {
			// validate ethereum
			if (!((data as any).signature instanceof Uint8Array)) {
				return false
			}
		} else {
			signalInvalidType(signatureType)
		}
	} catch (error) {
		return false
	}

	return true
}

export function encodeReadableEthereumMessage(message: CosmosMessage): string {
	return `
	Authorize access?
	address: ${message.address}
	chainId: ${message.chainId}
	expirationTime: ${message.expirationTime}
	issuedAt: ${message.issuedAt}
	uri: ${message.uri}
	`
}

export function parseAddress(address: string): [chain: string, walletAddress: string] {
	const result = addressPattern.exec(address)
	if (result === null) {
		throw new Error(`invalid address: ${address} did not match ${addressPattern}`)
	}

	const [_, chain, walletAddress] = result
	return [chain, walletAddress]
}
