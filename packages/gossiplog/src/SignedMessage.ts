import { sha256 } from "@noble/hashes/sha256"

import type { Signature, Message } from "@canvas-js/interfaces"

import { encodeClock } from "./clock.js"
import { encodeSignedMessage, decodeSignedMessage } from "./schema.js"
import { KEY_LENGTH, decodeId, getKey } from "./ids.js"

export class SignedMessage<Payload = unknown> {
	public static decode<Payload = unknown>(value: Uint8Array): SignedMessage<Payload> {
		const { signature, message } = decodeSignedMessage(value)
		return new SignedMessage<Payload>(signature, message as Message<Payload>, value)
	}

	public static encode<Payload>(signature: Signature, message: Message<Payload>): SignedMessage<Payload> {
		const value = encodeSignedMessage(signature, message)
		return new SignedMessage(signature, message, value)
	}

	public readonly id: string
	public readonly key: Uint8Array

	private constructor(
		public readonly signature: Signature,
		public readonly message: Message<Payload>,
		public readonly value: Uint8Array,
	) {
		this.key = getKey(message.clock, value)
		this.id = decodeId(this.key)
	}
}
