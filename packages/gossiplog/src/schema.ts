import * as cbor from "@ipld/dag-cbor"

import { fromDSL } from "@ipld/schema/from-dsl.js"
import { create } from "@ipld/schema/typed.js"

import { CID, varint } from "multiformats"

import type { IPLDValue, Message, SignedMessage } from "@canvas-js/interfaces"
import { Signature, createSignedValue, getCID } from "@canvas-js/signed-value"

import { assert, getClock } from "./utils.js"

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

export function decodeSignedMessage<Payload extends IPLDValue>(
	value: Uint8Array,
	validatePayload: (value: IPLDValue) => value is Payload
): SignedMessage<Payload> {
	const signedMessage = toSignedMessage(cbor.decode(value)) as SignedMessage
	const {
		signature,
		message: { clock, parents, payload },
	} = signedMessage

	assert(validatePayload(payload), "failed to validate message payload")
	assert(clock === getClock(parents), "invalid message clock")

	const message: Message<Payload> = { clock, parents, payload }

	return { signature, message }
}

export function encodeSignedMessage(signedMessage: SignedMessage): Uint8Array {
	return cbor.encode(fromSignedMessage(signedMessage))
}
