import { varint } from "multiformats"

import { base58btc } from "multiformats/bases/base58"

export const service = "bsky.social"
export const getKey = (topic: string) => `canvas/${topic}/atp/${service}`

const verificationKeyPattern = /^did:key:(z[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)$/
const k256 = 0xe7
const p256 = 0x1200

export function parseVerificationMethod(
	verificationMethod: string
): [type: "k256" | "p256", verificationKey: Uint8Array] {
	const match = verificationKeyPattern.exec(verificationMethod)
	assert(match !== null, "invalid verification key")
	const [_, key] = match
	const bytes = base58btc.decode(key)
	const [codec, encodingLength] = varint.decode(bytes)
	const publicKey = bytes.subarray(encodingLength)
	if (codec === k256) {
		return ["k256", publicKey]
	} else if (codec === p256) {
		return ["p256", publicKey]
	} else {
		throw new Error("invalid key codec")
	}
}

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}
