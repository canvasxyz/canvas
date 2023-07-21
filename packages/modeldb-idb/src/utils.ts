import { ModelValue } from "@canvas-js/modeldb-interface"
import { blake3 } from "@noble/hashes/blake3"
import { encode } from "microcbor"
import { base58btc } from "multiformats/bases/base58"

export const DEFAULT_DIGEST_LENGTH = 16

export function getRecordHash(value: ModelValue, dkLen: number = DEFAULT_DIGEST_LENGTH): string {
	const bytes = encode(value)
	const hash = blake3(bytes, { dkLen })
	return base58btc.baseEncode(hash)
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}
