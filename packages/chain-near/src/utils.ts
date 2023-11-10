import { NEARMessage, NEARSessionData } from "./types"

export const getKey = (topic: string, address: string) => `canvas/${topic}/${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const addressPattern = /^near:([0-9a-z-_]+):([a-zA-Fa-f0-9]+)$/

export const generateHumanReadableNearMessage = (message: NEARMessage): string =>
	`Authorize:
  - Wallet Address: ${message.walletAddress}
  - Chain ID: ${message.chainId}
  - URI: ${message.uri}
  - Issued At: ${message.issuedAt}
  - Expiration Time: ${message.expirationTime}
  `

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateSessionData(data: any): data is NEARSessionData {
	// TODO: implement
	return true
}
