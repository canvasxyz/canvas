import { ethers } from "ethers"
import { bech32 } from "bech32"
import { encodeAddress as encodeSS58Address, decodeAddress as decodeSS58Address } from "@polkadot/util-crypto"

import { Chain, ChainId } from "@canvas-js/interfaces"

import { bech32Prefixes } from "./cosmos.js"
import { signalInvalidType } from "../utils.js"

const { arrayify, hexlify, base58 } = ethers.utils

export function encodeSignature(chain: Chain, chainId: ChainId, signature: string): Uint8Array {
	if (chain == "eth") {
		return arrayify(signature)
	} else if (chain == "cosmos") {
		// "utf-8"?
		return new TextEncoder().encode(signature)
	} else {
		throw Error("unsupported")
	}
}

export function decodeSignature(chain: Chain, chainId: ChainId, signature: Uint8Array): string {
	if (chain == "eth") {
		return hexlify(signature)
	} else if (chain == "cosmos") {
		return new TextDecoder().decode(signature)
	} else {
		throw Error("unsupported")
	}
}

export function encodeAddress(chain: Chain, chainId: ChainId, address: string): Uint8Array {
	if (chain === "eth") {
		return arrayify(address)
	} else if (chain === "cosmos") {
		if (chainId in bech32Prefixes) {
			const { prefix, words } = bech32.decode(address)
			if (prefix !== bech32Prefixes[chainId] && prefix !== "cosmos") {
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
	} else {
		signalInvalidType(chain)
	}
}

export function decodeAddress(chain: Chain, chainId: ChainId, address: Uint8Array): string {
	if (chain === "eth") {
		return hexlify(address)
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
	} else {
		signalInvalidType(chain)
	}
}

export function encodeBlockhash(chain: Chain, chainId: ChainId, blockhash: string): Uint8Array {
	if (chain === "eth") {
		return arrayify(blockhash)
	} else if (chain === "cosmos") {
		return arrayify(blockhash)
	} else if (chain === "solana") {
		return base58.decode(blockhash)
	} else if (chain === "substrate") {
		return arrayify(blockhash)
	} else {
		signalInvalidType(chain)
	}
}

export function decodeBlockhash(chain: Chain, chainId: ChainId, blockhash: Uint8Array): string {
	if (chain === "eth") {
		return hexlify(blockhash)
	} else if (chain === "cosmos") {
		return hexlify(blockhash)
	} else if (chain === "solana") {
		return base58.encode(blockhash)
	} else if (chain === "substrate") {
		return hexlify(blockhash)
	} else {
		signalInvalidType(chain)
	}
}
