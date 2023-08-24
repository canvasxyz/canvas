import { varint } from "multiformats"
import { sha256 } from "@noble/hashes/sha256"
import * as cbor from "@ipld/dag-cbor"

import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import type { Message, SignedMessage } from "@canvas-js/interfaces"
import type { Signature } from "@canvas-js/signed-cid"

import { assert } from "./utils.js"

const schema = fromDSL(`
type SignedMessage struct {
	signature Signature
	message Message
} representation tuple

type Signature struct {
	type String
	publicKey Bytes
	signature Bytes
	cid &Message
} representation tuple

type Message struct {
	clock Int
	parents [Bytes]
	payload any
}`)

const { toTyped: toSignedMessage, toRepresentation: fromSignedMessage } = create(schema, "SignedMessage")

export function decodeSignedMessage(value: Uint8Array): [key: Uint8Array, signature: Signature, message: Message] {
	const signedMessage = toSignedMessage(cbor.decode(value)) as SignedMessage
	const { signature, message } = signedMessage
	assert(message.clock === getClock(message.parents), "invalid message clock")
	const key = getKey(message.clock, sha256(value))
	return [key, signature, message]
}

export function encodeSignedMessage(signedMessage: SignedMessage): [key: Uint8Array, value: Uint8Array] {
	const value = cbor.encode(fromSignedMessage(signedMessage))
	const key = getKey(signedMessage.message.clock, sha256(value))
	return [key, value]
}

// keys are made by concatenating an unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly, e.g "ah3rrroxiggl5rhzywo3oaprep5xt6oo"
const KEY_LENGTH = 20
function getKey(clock: number, hash: Uint8Array): Uint8Array {
	const encodingLength = varint.encodingLength(clock)
	const key = new Uint8Array(KEY_LENGTH)
	varint.encodeTo(clock, key, 0)
	key.set(hash.subarray(0, key.byteLength - encodingLength), encodingLength)
	return key
}

export function getClock(parents: Uint8Array[]) {
	let max = 1
	for (const parent of parents) {
		assert(parent.byteLength === KEY_LENGTH)
		const [clock] = varint.decode(parent)
		if (clock > max) {
			max = clock
		}
	}

	return max
}
