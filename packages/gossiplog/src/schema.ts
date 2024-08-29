import * as cbor from "@ipld/dag-cbor"

import { Message, Signature } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { encodeId, decodeId, KEY_LENGTH } from "./ids.js"
import { decodeClock } from "./clock.js"

export type SignatureTuple = [codec: string, publicKey: string, signature: Uint8Array]
export type MessageTuple = [
	signature: SignatureTuple,
	topic: string,
	clock: number,
	parents: Uint8Array[],
	payload: unknown,
]

// export function parseClock(bytes: Uint8Array): number {
// 	return 0
// }

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

export function decodeSignedMessage(value: Uint8Array): { signature: Signature; message: Message } {
	const messageTuple = cbor.decode(value)
	validateMessageTuple(messageTuple)

	const [[codec, publicKey, signature], topic, clock, parents, payload] = messageTuple
	return {
		signature: { codec, publicKey, signature },
		message: { topic, clock, parents: parents.map(decodeId), payload },
	}
}

export function encodeSignedMessage(
	{ codec, publicKey, signature }: Signature,
	{ topic, clock, parents, payload }: Message,
): Uint8Array {
	const parentKeys = parents.map(encodeId)
	assert(clock === getNextClock(parentKeys), "expected clock === getNextClock(parentKeys)")
	return cbor.encode([[codec, publicKey, signature], topic, clock, parentKeys, payload])
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
