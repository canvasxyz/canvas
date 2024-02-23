import { assert } from "@canvas-js/utils"

export const eip155AddressPattern = /^eip155:(\d+):(0x[a-fA-F0-9]+)$/

export function parseEip155Address(address: string): { chainId: number; address: `0x${string}` } {
	const result = eip155AddressPattern.exec(address)
	assert(result !== null)
	const [_, chainIdResult, addressResult] = result
	return { chainId: parseInt(chainIdResult), address: addressResult as `0x${string}` }
}
