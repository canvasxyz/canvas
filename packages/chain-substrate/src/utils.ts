import { CID } from "multiformats/cid"

import type { SubstrateMessage, SubstrateSessionData } from "./types"
import { encodeAddress, mnemonicGenerate } from "@polkadot/util-crypto"
import { KeypairType } from "@polkadot/util-crypto/types"
import { Keyring } from "@polkadot/keyring"

export const getKey = (topic: string, chain: string, address: string) => `canvas:${topic}/${chain}:${address}`

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}
const validateSubstrateKeyType = (value: unknown): value is KeypairType => {
	const validValues = ["ed25519", "sr25519", "ecdsa", "ethereum"]
	return validValues.includes(value as string)
}

function validateSubstrateMessage(message: unknown): message is SubstrateMessage {
	try {
		const { address, chainId, uri, issuedAt, expirationTime, ...otherFields } = message as SubstrateMessage
		if (typeof address !== "string") {
			return false
		}
		if (typeof chainId !== "string") {
			return false
		}
		if (typeof uri !== "string") {
			return false
		}
		if (typeof issuedAt !== "string") {
			return false
		}
		if (typeof expirationTime !== "number" && expirationTime !== null) {
			return false
		}
		if (Object.entries(otherFields).length > 0) {
			return false
		}
		return true
	} catch (e) {
		return false
	}
}

export function validateSessionData(data: unknown): data is SubstrateSessionData {
	if (data === undefined || data === null) {
		return false
	} else if (typeof data === "boolean" || typeof data === "number" || typeof data === "string") {
		return false
	} else if (CID.asCID(data) !== null) {
		return false
	} else if (data instanceof Uint8Array) {
		return false
	} else if (Array.isArray(data)) {
		return false
	}

	const { signature, substrateKeyType, data: messageData } = data as Record<string, any>
	if (!signature) {
		return false
	}

	if (!validateSubstrateKeyType(substrateKeyType)) {
		return false
	}

	if (!validateSubstrateMessage(messageData)) {
		return false
	}

	if (!(signature instanceof Uint8Array)) {
		return false
	}

	return true
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export const chainPattern = /^polkadot:([a-f0-9]+)$/

export function parseChainId(chain: string): string {
	const chainPatternMatch = chainPattern.exec(chain)
	if (chainPatternMatch === null) {
		throw new Error(`invalid chain: ${chain} did not match ${chainPattern}`)
	}

	const [_, chainId] = chainPatternMatch
	return chainId
}

export function getSessionURI(chain: string, publicKey: Uint8Array) {
	const sessionAddress = encodeAddress(publicKey)
	return `${chain}:${sessionAddress}`
}

export function randomKeypair(keyType: KeypairType) {
	const mnemonic = mnemonicGenerate()
	return new Keyring({
		type: keyType,
	}).addFromMnemonic(mnemonic)
}
