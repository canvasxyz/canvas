import { varint } from "multiformats"
import { base32hex } from "multiformats/bases/base32"
import { sha256 } from "@noble/hashes/sha256"
import * as cbor from "@ipld/dag-cbor"

import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import type { Message } from "@canvas-js/interfaces"
import type { Signature } from "@canvas-js/signed-cid"

import { assert } from "./utils.js"

const schema = fromDSL(`
type SignedMessage struct {
	signature nullable Signature
	message Message
} representation tuple

type Signature struct {
	type String
	publicKey Bytes
	signature Bytes
	cid &Message
} representation tuple

type Message struct {
	parents [Bytes]
	payload any
} representation tuple
`)

const { toTyped: toSignedMessage, toRepresentation: fromSignedMessage } = create(schema, "SignedMessage")

type SignedMessage = {
	signature: Signature | null
	message: {
		parents: Uint8Array[]
		payload: unknown
	}
}

export function decodeSignedMessage(
	value: Uint8Array
): [key: Uint8Array, signature: Signature | null, message: Message] {
	const signedMessage = toSignedMessage(cbor.decode(value)) as SignedMessage
	const {
		signature,
		message: { parents, payload },
	} = signedMessage

	const clock = getClock(parents)
	const key = getKey(clock, sha256(value))
	return [key, signature, { clock, parents: parents.map(decodeId), payload }]
}

export function encodeSignedMessage(
	signature: Signature | null,
	message: Message
): [key: Uint8Array, value: Uint8Array] {
	const parents = message.parents.map(encodeId)
	assert(
		parents.every((key) => key.byteLength === KEY_LENGTH),
		"expected key.byteLength === KEY_LENGTH"
	)

	const signedMessage: SignedMessage = { signature, message: { parents, payload: message.payload } }
	const value = cbor.encode(fromSignedMessage(signedMessage))
	const clock = getClock(parents)
	const key = getKey(clock, sha256(value))
	return [key, value]
}

export function getClock(parents: Uint8Array[] | string[]) {
	let max = 0
	for (const parent of parents) {
		const key = typeof parent === "string" ? encodeId(parent) : parent
		assert(key.byteLength === KEY_LENGTH, "expected key.byteLength === KEY_LENGTH")
		const [clock] = varint.decode(key)
		if (clock > max) {
			max = clock
		}
	}

	return max + 1
}

// keys are made by concatenating an unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"
export const KEY_LENGTH = 20

function getKey(clock: number, hash: Uint8Array): Uint8Array {
	const encodingLength = varint.encodingLength(clock)
	const key = new Uint8Array(KEY_LENGTH)
	varint.encodeTo(clock, key, 0)
	key.set(hash.subarray(0, key.byteLength - encodingLength), encodingLength)
	return key
}

// encoding is in the eye of the beholder
export const encodeId = (id: string) => base32hex.baseDecode(id)
export const decodeId = (key: Uint8Array) => base32hex.baseEncode(key)
