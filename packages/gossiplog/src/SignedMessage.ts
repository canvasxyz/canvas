import { sha256 } from "@noble/hashes/sha256"
import * as cbor from "@ipld/dag-cbor"
import { compare } from "uint8arrays"
import { assert } from "@canvas-js/utils"

import type { Signature, Message } from "@canvas-js/interfaces"

import { MessageId, decodeId, encodeId, KEY_LENGTH } from "./MessageId.js"
import { MessageSet } from "./MessageSet.js"
import { decodeClock, encodeClock } from "./clock.js"
import { topicPattern } from "./utils.js"

export type MessageSourceType = "pubsub" | "push" | "sync"
export type MessageSource = { type: MessageSourceType; peer: string }
export type MessageContext<Result> = { source?: MessageSource; result?: Result }

export class SignedMessage<Payload = unknown, Result = any> {
	public static decode<Payload = unknown, Result = any>(
		value: Uint8Array,
		context: MessageContext<Result> = {},
	): SignedMessage<Payload, Result> {
		const [[codec, publicKey, signature], topic, clock, parentKeys, payload] = decodeMessageTuple(value)
		const parents = new MessageSet(parentKeys)
		const parentIds = [...parents].map((parent) => parent.id)
		return new SignedMessage<Payload, Result>(
			{ codec, publicKey, signature },
			{ topic, clock, parents: parentIds, payload: payload as Payload },
			value,
			parents,
			context,
		)
	}

	public static encode<Payload, Result>(
		{ codec, publicKey, signature }: Signature,
		message: Message<Payload>,
		context: MessageContext<Result> = {},
	): SignedMessage<Payload, Result> {
		const { topic, clock, parents: parentIds, payload } = message
		parentIds.sort()
		const parents = new MessageSet(parentIds)
		const parentKeys = [...parents].map((parent) => parent.key)
		const value = encodeMessageTuple([[codec, publicKey, signature], topic, clock, parentKeys, payload])
		return new SignedMessage({ codec, publicKey, signature }, message, value, parents, context)
	}

	public readonly id: string
	public readonly key: Uint8Array
	public readonly hash: Uint8Array
	public readonly source?: MessageSource
	public result?: Result

	private constructor(
		public readonly signature: Signature,
		public readonly message: Message<Payload>,
		public readonly value: Uint8Array,
		public readonly parents: MessageSet,
		context: MessageContext<Result>,
	) {
		this.hash = sha256(value)
		this.key = new Uint8Array(KEY_LENGTH)
		const encodingLength = encodeClock(this.key, message.clock)
		this.key.set(this.hash.subarray(0, KEY_LENGTH - encodingLength), encodingLength)

		this.id = decodeId(this.key)
		this.source = context.source
		this.result = context.result
	}
}

type SignatureTuple = [codec: string, publicKey: string, signature: Uint8Array]

type MessageTuple<Payload> = [
	signature: SignatureTuple,
	topic: string,
	clock: number,
	parents: Uint8Array[],
	payload: Payload,
]

function validateSignatureTuple(signatureTuple: unknown): asserts signatureTuple is SignatureTuple {
	assert(Array.isArray(signatureTuple), "expected Array.isArray(signatureTuple)")
	assert(signatureTuple.length === 3, "expected signatureTuple.length === 5")
	const [codec, publicKey, signature] = signatureTuple
	assert(typeof codec === "string", 'expected typeof codec === "string"')
	assert(typeof publicKey === "string", 'expected typeof publicKey === "string"')
	assert(signature instanceof Uint8Array, "expected signature instanceof Uint8Array")
}

function validateMessageTuple<Payload>(messageTuple: unknown): asserts messageTuple is MessageTuple<Payload> {
	assert(Array.isArray(messageTuple), "expected Array.isArray(messageTuple)")
	assert(messageTuple.length === 5, "messageTuple.length === 5")

	const [signature, topic, clock, parents, payload] = messageTuple
	validateSignatureTuple(signature)

	assert(typeof topic === "string", 'expected typeof topic === "string"')
	assert(topicPattern.test(topic), "invalid topic string")

	assert(typeof clock === "number", 'expected typeof clock === "number"')
	validateMessageParents(parents)

	assert(
		(clock === 0 && parents.length === 0) || clock === getNextClock(parents),
		"expected clock === getNextClock(parents)",
	)
}

function validateMessageParents(parents: any): asserts parents is Uint8Array[] {
	assert(Array.isArray(parents), "expected Array.isArray(parents)")
	for (const [i, parent] of parents.entries()) {
		assert(parent instanceof Uint8Array, "expected parent instanceof Uint8Array")
		assert(parent.length === KEY_LENGTH, "expected parent.length === KEY_LENGTH")
		if (i > 0) {
			assert(compare(parent, parents[i - 1]) === 1, "expected parents to be sorted lexicographically")
		}
	}
}

function encodeMessageTuple<Payload>(messageTuple: MessageTuple<Payload>) {
	return cbor.encode(messageTuple)
}

function decodeMessageTuple<Payload>(data: Uint8Array) {
	const messageTuple = cbor.decode(data)
	validateMessageTuple<Payload>(messageTuple)
	return messageTuple
}

export function getNextClock(parents: MessageSet | string[] | Uint8Array[]): number {
	let max = 0
	for (const parent of parents) {
		let clock: number
		if (parent instanceof MessageId) {
			clock = parent.clock
		} else if (typeof parent === "string") {
			clock = decodeClock(encodeId(parent))[0]
		} else {
			clock = decodeClock(parent)[0]
		}

		if (clock > max) {
			max = clock
		}
	}

	return max + 1
}
