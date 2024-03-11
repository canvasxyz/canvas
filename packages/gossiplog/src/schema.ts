import { sha256 } from "@noble/hashes/sha256"

import { base32hex } from "multiformats/bases/base32"

import * as cbor from "@ipld/dag-cbor"

import { Message, Signature } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { decodeClock, encodeClock } from "./clock.js"

export type SignatureTuple = [codec: string, publicKey: string, signature: Uint8Array]
export type MessageTuple = [
	signature: SignatureTuple,
	topic: string,
	clock: number,
	parents: Uint8Array[],
	payload: unknown,
]

function validateSignatureTuple(signatureTuple: unknown): asserts signatureTuple is SignatureTuple {
	assert(Array.isArray(signatureTuple), "expected Array.isArray(signatureTuple)")
	assert(signatureTuple.length === 3, "expected signatureTuple.length === 3")
	const [codec, publicKey, signature] = signatureTuple
	assert(typeof codec === "string", 'expected typeof codec === "string"')
	assert(typeof publicKey === "string", 'expected typeof publicKey === "string"')
	assert(signature instanceof Uint8Array, "expected signature instanceof Uint8Array")
}

function validateMessageTuple(messageTuple: unknown): asserts messageTuple is MessageTuple {
	assert(Array.isArray(messageTuple), "expected Array.isArray(messageTuple)")
	assert(messageTuple.length === 5, "messageTuple.length === 3")

	const [signature, topic, clock, parents] = messageTuple
	validateSignatureTuple(signature)
	assert(typeof topic === "string", 'expected typeof topic === "string"')
	assert(typeof clock === "number", 'expected typeof clock === "number"')
	assert(Array.isArray(parents), "expected Array.isArray(parents)")
	for (const parent of parents) {
		assert(parent instanceof Uint8Array), "expected parent instanceof Uint8Array"
		assert(parent.length === KEY_LENGTH, "expected parent.length === KEY_LENGTH")
	}

	assert(clock === getNextClock(parents), "expected clock === getNextClock(parents)")
}

export function decodeSignedMessage(value: Uint8Array): [id: string, signature: Signature, message: Message] {
	const messageTuple = cbor.decode(value)
	validateMessageTuple(messageTuple)

	const [[codec, publicKey, signature], topic, clock, parents, payload] = messageTuple
	const key = getKey(clock, value)
	return [decodeId(key), { codec, publicKey, signature }, { topic, clock, parents: parents.map(decodeId), payload }]
}

export function encodeSignedMessage(
	{ codec, publicKey, signature }: Signature,
	{ topic, clock, parents, payload }: Message,
): [key: Uint8Array, value: Uint8Array] {
	const parentKeys = parents.map(encodeId)
	assert(clock === getNextClock(parentKeys), "expected clock === getNextClock(parentKeys)")
	const value = cbor.encode([[codec, publicKey, signature], topic, clock, parentKeys, payload])
	const key = getKey(clock, value)
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

// keys are made by concatenating a **reverse** unsigned varint clock with the hash
// and truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"
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
