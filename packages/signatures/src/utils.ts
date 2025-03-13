import { varint } from "multiformats"
import { base58btc } from "multiformats/bases/base58"

import { Message } from "@canvas-js/interfaces"
import { assert, stripUndefined, replaceUndefined } from "@canvas-js/utils"

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

export function encodeURI(type: string, publicKey: Uint8Array) {
	const { code } = didKeyTypes.find((keyType) => keyType.type === type) ?? {}
	assert(code !== undefined, "invalid did:key type")
	const encodingLength = varint.encodingLength(code)
	const bytes = new Uint8Array(encodingLength + publicKey.byteLength)
	varint.encodeTo(code, bytes, 0)
	bytes.set(publicKey, encodingLength)
	return `did:key:${base58btc.encode(bytes)}`
}

/** strip `undefined` object properties, and replace `undefined` with `null` in arrays */
export function prepareMessage<T>(message: Message<T>): Message<T> {
	let payload = message.payload
	payload = stripUndefined(message.payload as any, false) as T
	payload = replaceUndefined(payload as any, true) as T
	return { ...message, payload }
}
