import { assert } from "@canvas-js/utils"
import { Eip712SessionData } from "./types.js"

export const addressPattern = /^did:pkh:eip155:(\d+):(0x[a-fA-F0-9]+)$/

export function parseAddress(address: string): { chainId: number; address: `0x${string}` } {
	const result = addressPattern.exec(address)
	assert(result !== null)
	const [_, chainIdResult, addressResult] = result
	return { chainId: parseInt(chainIdResult), address: addressResult as `0x${string}` }
}

export function validateEip712SessionData(authorizationData: unknown): authorizationData is Eip712SessionData {
	try {
		const { signature } = authorizationData as any
		assert(signature instanceof Uint8Array, "signature must be a Uint8Array")
		return true
	} catch (e) {
		return false
	}
}
