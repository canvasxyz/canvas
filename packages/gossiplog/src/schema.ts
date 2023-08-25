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
	clock Int
	parents [Bytes]
	payload any
} representation tuple
`)

const { toTyped: toSignedMessage, toRepresentation: fromSignedMessage } = create(schema, "SignedMessage")

export function decodeSignedMessage(
	value: Uint8Array,
	options: { signatures: boolean; sequencing: boolean }
): [key: Uint8Array, signature: Signature | null, message: Message] {
	const signedMessage = toSignedMessage(cbor.decode(value)) as SignedMessage
	const { signature, message } = signedMessage
	if (options.signatures) {
		assert(signature !== null, "missing message signature")
	}

	assert(message.clock === getClock(message.parents), "invalid message clock")
	const key = getKey(message.clock, sha256(value))
	return [key, signature, message]
}

export function encodeSignedMessage(
	signature: Signature | null,
	message: Message,
	options: { signatures: boolean; sequencing: boolean }
): [key: Uint8Array, value: Uint8Array] {
	const { clock } = message
	if (options.sequencing) {
		assert(clock > 0, "expected message.clock > 0 if sequencing is enable")
	} else {
		assert(clock === 0, "expected message.clock === 0 if sequencing is disabled")
	}

	if (options.signatures) {
		assert(signature !== null, "missing message signature")
	}

	const value = cbor.encode(fromSignedMessage({ signature, message }))
	const key = getKey(clock, sha256(value))
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
	let max = 0
	for (const parent of parents) {
		assert(parent.byteLength === KEY_LENGTH)
		const [clock] = varint.decode(parent)
		if (clock > max) {
			max = clock
		}
	}

	return max + 1
}
