import { ethers } from "ethers"
import { bech32 } from "bech32"
import { encodeAddress as encodeSS58Address, decodeAddress as decodeSS58Address } from "@polkadot/util-crypto"

import { Chain, ChainId } from "@canvas-js/interfaces"

import { bech32Prefixes } from "./cosmos.js"
import { signalInvalidType } from "../utils.js"

const { arrayify, hexlify, base58, getAddress } = ethers.utils

export function encodeAddress(chain: Chain, chainId: ChainId, address: string): Uint8Array {
	if (chain === "ethereum") {
		return arrayify(address)
	} else if (chain === "cosmos") {
		if (chainId in bech32Prefixes) {
			const { prefix, words } = bech32.decode(address)
			if (prefix !== bech32Prefixes[chainId]) {
				throw new Error(`cosmos address ${address} does not match the provided chainId ${chainId}`)
			}

			return new Uint8Array(bech32.fromWords(words))
		} else {
			throw new Error(`unknown cosmos chainId: ${chainId}`)
		}
	} else if (chain === "solana") {
		return base58.decode(address)
	} else if (chain === "substrate") {
		return decodeSS58Address(address)
	} else if (chain === "near") {
		throw Error("The NEAR chain is not supported")
	} else {
		signalInvalidType(chain)
	}
}

export function decodeAddress(chain: Chain, chainId: ChainId, address: Uint8Array): string {
	if (chain === "ethereum") {
		return getAddress(hexlify(address))
	} else if (chain === "cosmos") {
		if (chainId in bech32Prefixes) {
			return bech32.encode(bech32Prefixes[chainId], bech32.toWords(address))
		} else {
			throw new Error(`unknown cosmos chainId ${chainId}`)
		}
	} else if (chain === "solana") {
		return base58.encode(address)
	} else if (chain === "substrate") {
		return encodeSS58Address(address)
	} else if (chain === "near") {
		throw Error("The NEAR chain is not supported")
	} else {
		signalInvalidType(chain)
	}
}

// encode block identifier (blockhash for eth, block number for cosmos)
export function encodeBlockhash(chain: Chain, chainId: ChainId, blockhash: string): Uint8Array {
	if (chain === "ethereum") {
		return arrayify(blockhash)
	} else if (chain === "cosmos") {
		return arrayify(blockhash)
	} else if (chain === "solana") {
		return base58.decode(blockhash)
	} else if (chain === "substrate") {
		return arrayify(blockhash)
	} else if (chain === "near") {
		throw Error("The NEAR chain is not supported")
	} else {
		signalInvalidType(chain)
	}
}

// decode block identifier (blockhash for eth, block number for cosmos)
export function decodeBlockhash(chain: Chain, chainId: ChainId, blockhash: Uint8Array): string {
	if (chain === "ethereum") {
		return hexlify(blockhash)
	} else if (chain === "cosmos") {
		return hexlify(blockhash)
	} else if (chain === "solana") {
		return base58.encode(blockhash)
	} else if (chain === "substrate") {
		return hexlify(blockhash)
	} else if (chain === "near") {
		throw Error("The NEAR chain is not supported")
	} else {
		signalInvalidType(chain)
	}
}
