import { NEARMessage, NEARSessionData } from "./types.js"

export const getKey = (topic: string, address: string) => `canvas/${topic}/${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const addressPattern = /^near:([0-9a-z-_]+):([a-zA-Z0-9]+)$/

export function parseAddress(address: string): [chain: string, walletAddress: string] {
	const result = addressPattern.exec(address)
	if (result === null) {
		throw new Error(`invalid address: ${address} did not match ${addressPattern}`)
	}

	const [_, chain, walletAddress] = result
	return [chain, walletAddress]
}

export const generateHumanReadableNearMessage = (message: NEARMessage): string =>
	`Authorize:
  - PublicKey: ${message.publicKey}
  - Issued At: ${message.issuedAt}
  - Expiration Time: ${message.expirationTime}
  `

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateSessionData(data: any): data is NEARSessionData {
	if (!(data.signature instanceof Uint8Array)) {
		return false
	}
	if (!(data.publicKey instanceof Uint8Array)) {
		return false
	}

	return true
}
