import type { EIP712SessionData } from "./types.js"
import { hexlify } from "ethers"
import target from "#target"

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateSessionData(authorizationData: unknown): authorizationData is EIP712SessionData {
	try {
		const { signature } = authorizationData as any
		assert(signature instanceof Uint8Array, "signature must be a Uint8Array")

		return true
	} catch (e) {
		return false
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

export function generateSalt() {
	return hexlify(target.getRandomValues(new Uint8Array(32)))
}
