import { base32hex } from "multiformats/bases/base32"
import { sha256 } from "@noble/hashes/sha256"
import * as cbor from "@ipld/dag-cbor"

import { fromDSL } from "@ipld/schema/from-dsl.js"
import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"

import type { Message } from "@canvas-js/interfaces"
import type { Signature } from "@canvas-js/signed-cid"
import { lessThan } from "@canvas-js/okra"

import { decodeClock, encodeClock } from "./clock.js"
import { assert } from "./utils.js"

const schema = fromDSL(`
type SignedMessage struct {
	signature Signature
	topic String
	parents [Bytes]
	payload any
} representation tuple

type Signature struct {
	type String
	publicKey Bytes
	signature Bytes
	cid &Message
} representation tuple
`)

const { toTyped: toSignedMessage, toRepresentation: fromSignedMessage } = create(schema, "SignedMessage")

type SignedMessage = {
	signature: Signature
	topic: string
	parents: Uint8Array[]
	payload: unknown
}

export function decodeSignedMessage<Payload = unknown>(
	value: Uint8Array,
	{ toTyped }: { toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
): [id: string, signature: Signature, message: Message<Payload>] {
	const signedMessage = toSignedMessage(cbor.decode(value)) as SignedMessage | undefined
	assert(signedMessage !== undefined, "error decoding message (internal error)")

	const { signature, topic } = signedMessage
	const clock = getClock(signedMessage.parents)
	const parents = signedMessage.parents ?? []

	assert(
		parents.every((id, i) => i === 0 || lessThan(parents[i - 1], id)),
		"unsorted parents array"
	)

	const payload = toTyped(signedMessage.payload)
	assert(payload !== undefined, "error decoding message (invalid payload)")

	const id = decodeId(getKey(clock, sha256(value)))

	return [id, signature, { topic, clock, parents: parents.map(decodeId), payload }]
}

export function encodeSignedMessage(
	signature: Signature,
	message: Message,
	{ toRepresentation }: { toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
): [key: Uint8Array, value: Uint8Array] {
	const parents = message.parents.sort().map(encodeId)
	assert(getClock(parents) === message.clock, "error encoding message (invalid clock)")

	const payload = toRepresentation(message.payload)
	assert(payload !== undefined, "error encoding message (invalid payload)")

	const signedMessage: SignedMessage = {
		signature,
		topic: message.topic,
		parents: parents,
		payload: payload,
	}

	const signedMessageRepresentation = fromSignedMessage(signedMessage)
	assert(signedMessageRepresentation !== undefined, "error encoding message (internal error)")

	const value = cbor.encode(signedMessageRepresentation)
	const key = getKey(message.clock, sha256(value))
	return [key, value]
}

export function getClock(parents: Uint8Array[]) {
	let max = 0n
	for (const key of parents) {
		assert(key.byteLength === KEY_LENGTH, "expected key.byteLength === KEY_LENGTH")
		const [clock] = decodeClock(key)
		if (clock > max) {
			max = clock
		}
	}

	return Number(max) + 1
}

// keys are made by concatenating an unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"
export const KEY_LENGTH = 20

function getKey(clock: number, hash: Uint8Array): Uint8Array {
	const key = new Uint8Array(KEY_LENGTH)
	const encodingLength = encodeClock(key, BigInt(clock))
	key.set(hash.subarray(0, KEY_LENGTH - encodingLength), encodingLength)
	return key
}

// encoding is in the eye of the beholder
export const encodeId = (id: string) => base32hex.baseDecode(id)
export const decodeId = (key: Uint8Array) => base32hex.baseEncode(key)
