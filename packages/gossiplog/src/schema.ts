import { secp256k1 } from "@noble/curves/secp256k1"
import { ed25519 } from "@noble/curves/ed25519"
import { sha256 } from "@noble/hashes/sha256"

import { varint } from "multiformats"
import { base32hex } from "multiformats/bases/base32"
import { base58btc } from "multiformats/bases/base58"

import * as cbor from "@ipld/dag-cbor"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"

import { lessThan } from "@canvas-js/okra"

import { getCID, didKeyPattern } from "@canvas-js/signed-cid"

import type { Signature, Message } from "@canvas-js/interfaces"

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

type SignedMessage = {
	publicKey: Uint8Array
	signature: Uint8Array
	parents: Uint8Array[]
	payload: unknown
}

export type Transformer = { toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
const identity: Transformer = { toTyped: (x: any) => x, toRepresentation: (x: any) => x }

export function decodeSignedMessage<Payload = unknown>(
	topic: string,
	value: Uint8Array,
	options: { transformer?: Transformer } = {}
): [id: string, signature: Signature, message: Message<Payload>] {
	const signedMessage = toSignedMessage(cbor.decode(value)) as SignedMessage | undefined
	assert(signedMessage !== undefined, "error decoding message (internal error)")

	const clock = getNextClock(signedMessage.parents)
	const parents = signedMessage.parents ?? []

	assert(
		parents.every((id, i) => i === 0 || lessThan(parents[i - 1], id)),
		"unsorted parents array"
	)

	const transformer = options.transformer ?? identity
	const payload = transformer.toTyped(signedMessage.payload)

	assert(payload !== undefined, "error decoding message (invalid payload)")

	const id = decodeId(getKey(clock, sha256(value)))

	const { publicKey, signature } = signedMessage
	const message: Message<Payload> = { topic, clock, parents: parents.map(decodeId), payload }
	const cid = getCID(message, { codec: "dag-cbor", digest: "sha2-256" })

	return [id, { publicKey: `did:key:${base58btc.encode(publicKey)}`, signature, cid }, message]
}

export function encodeSignedMessage(
	{ publicKey, signature }: Signature,
	message: Message,
	options: { transformer?: Transformer } = {}
): [key: Uint8Array, value: Uint8Array] {
	const parents = message.parents.sort().map(encodeId)
	assert(getNextClock(parents) === message.clock, "error encoding message (invalid clock)")

	const transformer = options.transformer ?? identity
	const payload = transformer.toRepresentation(message.payload)
	assert(payload !== undefined, "error encoding message (invalid payload)")

	const result = didKeyPattern.exec(publicKey)
	assert(result !== null)
	const [{}, bytes] = result

	const signedMessage: SignedMessage = {
		publicKey: base58btc.decode(bytes),
		signature: signature,
		parents: parents,
		payload: payload,
	}

	const signedMessageRepresentation = fromSignedMessage(signedMessage)
	assert(signedMessageRepresentation !== undefined, "error encoding message (internal error)")

	const value = cbor.encode(signedMessageRepresentation)
	const key = getKey(message.clock, sha256(value))
	return [key, value]
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

// keys are made by concatenating an unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"
export const KEY_LENGTH = 20
export const MIN_MESSAGE_ID = "00000000000000000000000000000000"
export const MAX_MESSAGE_ID = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"
export const messageIdPattern = /^[0123456789abcdefghijklmnopqrstuv]{32}$/

function getKey(clock: number, hash: Uint8Array): Uint8Array {
	const key = new Uint8Array(KEY_LENGTH)
	const encodingLength = encodeClock(key, clock)
	key.set(hash.subarray(0, KEY_LENGTH - encodingLength), encodingLength)
	return key
}

// encoding is in the eye of the beholder
export const encodeId = (id: string) => base32hex.baseDecode(id)
export const decodeId = (key: Uint8Array) => base32hex.baseEncode(key)
