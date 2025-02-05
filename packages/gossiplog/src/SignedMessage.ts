import type { Signature, Message } from "@canvas-js/interfaces"

import { encodeSignedMessage, decodeSignedMessage } from "./schema.js"
import { decodeId, getKey } from "./ids.js"

export type MessageSourceType = "pubsub" | "push" | "sync"
export type MessageSource = { type: MessageSourceType; peer: string }

export type MessageContext<Result> = { source?: MessageSource; branch?: number; result?: Result }

export class SignedMessage<Payload = unknown, Result = any> {
	public static decode<Payload = unknown, Result = any>(
		value: Uint8Array,
		context: MessageContext<Result> = {},
	): SignedMessage<Payload, Result> {
		const { signature, message } = decodeSignedMessage(value)
		return new SignedMessage<Payload, Result>(signature, message as Message<Payload>, value, context)
	}

	public static encode<Payload, Result>(
		signature: Signature,
		message: Message<Payload>,
		context: MessageContext<Result> = {},
	): SignedMessage<Payload, Result> {
		const value = encodeSignedMessage(signature, message)
		return new SignedMessage(signature, message, value, context)
	}

	public readonly id: string
	public readonly key: Uint8Array
	public readonly source?: MessageSource
	public branch?: number
	public result?: Result

	private constructor(
		public readonly signature: Signature,
		public readonly message: Message<Payload>,
		public readonly value: Uint8Array,
		context: MessageContext<Result>,
	) {
		this.key = getKey(message.clock, value)
		this.id = decodeId(this.key)
		this.source = context.source
		this.branch = context.branch
		this.result = context.result
	}
}
