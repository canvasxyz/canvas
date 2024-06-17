// IDs are made by concatenating a **reverse** unsigned varint clock with the hash and then
// truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"

import { sha256 } from "@noble/hashes/sha256"
import { base32hex } from "multiformats/bases/base32"
import { encodeClock } from "./clock.js"

export const KEY_LENGTH = 20
export const ID_LENGTH = 32
export const MIN_MESSAGE_ID = "00000000000000000000000000000000"
export const MAX_MESSAGE_ID = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"
export const messageIdPattern = /^[0123456789abcdefghijklmnopqrstuv]{32}$/

export function getKey(clock: number, value: Uint8Array): Uint8Array {
	const hash = sha256(value)
	const key = new Uint8Array(KEY_LENGTH)
	const encodingLength = encodeClock(key, clock)
	key.set(hash.subarray(0, KEY_LENGTH - encodingLength), encodingLength)
	return key
}

export const encodeId = (id: string) => base32hex.baseDecode(id)
export const decodeId = (key: Uint8Array) => base32hex.baseEncode(key)
