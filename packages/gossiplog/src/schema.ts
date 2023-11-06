import { sha256 } from "@noble/hashes/sha256"

import { base32hex } from "multiformats/bases/base32"

import * as cbor from "@ipld/dag-cbor"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import { decodeClock, encodeClock } from "./clock.js"
import { assert } from "./utils.js"

const schema = fromDSL(`
type SignedMessage struct {
	publicKey Bytes
	signature Bytes
	parents  [Bytes]
	payload   any
} representation tuple
`)

const { toTyped: toSignedMessage, toRepresentation: fromSignedMessage } = create(schema, "SignedMessage")

export type SignedMessage = {
	publicKey: Uint8Array
	signature: Uint8Array
	parents: Uint8Array[]
	payload: unknown
}

export function decodeSignedMessage(value: Uint8Array): SignedMessage {
	const representation = cbor.decode(value)
	const signedMessage = toSignedMessage(representation) as SignedMessage | undefined
	assert(signedMessage !== undefined, "error decoding message (internal error)")
	return signedMessage
}

export function encodeSignedMessage(signedMessage: SignedMessage): Uint8Array {
	const representation = fromSignedMessage(signedMessage)
	assert(representation !== undefined, "error decoding message (internal error)")
	return cbor.encode(representation)
}

export function getNextClock(parents: Uint8Array[]): number {
	let max = 0
	for (const key of parents) {
		assert(key.byteLength === KEY_LENGTH, "expected key.byteLength === KEY_LENGTH")
		const [clock] = decodeClock(key)
		if (clock > max) {
			max = clock
		}
	}

	return max + 1
}

// keys are made by concatenating a **reverse** unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"
export const KEY_LENGTH = 20
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

// encoding is in the eye of the beholder
export const encodeId = (id: string) => base32hex.baseDecode(id)
export const decodeId = (key: Uint8Array) => base32hex.baseEncode(key)
