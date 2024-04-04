import { varint } from "multiformats"
import { base58btc } from "multiformats/bases/base58"

import { assert } from "@canvas-js/utils"

export const didKeyPattern = /^did:key:(z[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)$/

export const didKeyTypes = [
	{ type: "ed25519", code: 0xed },
	{ type: "secp256k1", code: 0xe7 },
] as const

export function decodeURI(uri: string): { type: "ed25519" | "secp256k1"; publicKey: Uint8Array } {
	const result = didKeyPattern.exec(uri)
	assert(result !== null, "expected did:key URI")
	const bytes = base58btc.decode(result[1])
	const [code, codeLength] = varint.decode(bytes)

	const { type } = didKeyTypes.find((keyType) => keyType.code === code) ?? {}
	assert(type !== undefined, "invalid did:key type")

	return { type, publicKey: bytes.subarray(codeLength) }
}

export function encodeURI(type: "ed25519" | "secp256k1", publicKey: Uint8Array) {
	const { code } = didKeyTypes.find((keyType) => keyType.type === type) ?? {}
	assert(code !== undefined, "invalid did:key type")
	const encodingLength = varint.encodingLength(code)
	const bytes = new Uint8Array(encodingLength + publicKey.byteLength)
	varint.encodeTo(code, bytes, 0)
	bytes.set(publicKey, encodingLength)
	return `did:key:${base58btc.encode(bytes)}`
}

export function deepEquals<T>(obj1: T, obj2: T) {
	if (obj1 === obj2) {
		return true
	}

	if (typeof obj1 !== "object" || typeof obj2 !== "object" || obj1 === null || obj2 === null) {
		return false
	}

	if (obj1 instanceof Uint8Array && obj2 instanceof Uint8Array) {
		return Buffer.compare(Buffer.from(obj1), Buffer.from(obj2)) === 0
	}

	const keys1 = Object.keys(obj1)
	const keys2 = Object.keys(obj2)

	if (keys1.length !== keys2.length) {
		return false
	}

	for (const key of keys1) {
		if (!keys2.includes(key)) {
			return false
		}

		const val1 = (obj1 as any)[key]
		const val2 = (obj2 as any)[key]

		if (typeof val1 === "object" && typeof val2 === "object") {
			if (!deepEquals(obj1, obj2)) {
				return false
			}
		} else if (obj1 !== obj2) {
			return false
		}
	}

	return true
}
