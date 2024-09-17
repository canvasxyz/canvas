import type { Signature, Message } from "@canvas-js/interfaces"

import { encodeSignedMessage, decodeSignedMessage } from "./schema.js"
import { decodeId, getKey } from "./ids.js"

export type MessageSource = { type: "pubsub" | "push" | "sync"; peer: string }

export type MessageContext = { source?: MessageSource; branch?: number }

export class SignedMessage<Payload = unknown> {
	public static decode<Payload = unknown>(value: Uint8Array, context: MessageContext = {}): SignedMessage<Payload> {
		const { signature, message } = decodeSignedMessage(value)
		return new SignedMessage<Payload>(signature, message as Message<Payload>, value, context)
	}

	public static encode<Payload>(
		signature: Signature,
		message: Message<Payload>,
		context: MessageContext = {},
	): SignedMessage<Payload> {
		const value = encodeSignedMessage(signature, message)
		return new SignedMessage(signature, message, value, context)
	}

	public readonly id: string
	public readonly key: Uint8Array
	public readonly source?: MessageSource
	public readonly branch?: number

	private constructor(
		public readonly signature: Signature,
		public readonly message: Message<Payload>,
		public readonly value: Uint8Array,
		context: MessageContext,
	) {
		this.key = getKey(message.clock, value)
		this.id = decodeId(this.key)
		this.source = context.source
		this.branch = context.branch
	}
}
