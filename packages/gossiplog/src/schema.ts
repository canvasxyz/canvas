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
	parents nullable [Bytes]
	payload any
} representation tuple
`)

const { toTyped: toSignedMessage, toRepresentation: fromSignedMessage } = create(schema, "SignedMessage")

type SignedMessage = {
	signature: Signature | null
	message: {
		parents: Uint8Array[] | null
		payload: unknown
	}
}

export function decodeSignedMessage(
	topic: string,
	value: Uint8Array
): [id: string, signature: Signature | null, message: Message] {
	const { signature, message } = toSignedMessage(cbor.decode(value)) as SignedMessage
	const clock = getClock(message.parents)
	const key = getKey(clock, sha256(value))
	const parents = message.parents?.map(decodeId) ?? []
	assert(
		parents.every((id, i) => i === 0 || parents[i - 1] < id),
		"unsorted parents array"
	)

	return [decodeId(key), signature, { topic, clock, parents, payload: message.payload }]
}

export function encodeSignedMessage(
	signature: Signature | null,
	{ clock, parents, payload }: Message
): [key: Uint8Array, value: Uint8Array] {
	parents.sort()

	const signedMessage: SignedMessage = {
		signature,
		message: {
			parents: clock === 0 ? null : parents.map(encodeId),
			payload,
		},
	}

	const value = cbor.encode(fromSignedMessage(signedMessage))
	const key = getKey(clock, sha256(value))
	return [key, value]
}

export function getClock(parents: Uint8Array[] | null) {
	if (parents === null) {
		return 0
	}

	let max = 0
	for (const key of parents) {
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
