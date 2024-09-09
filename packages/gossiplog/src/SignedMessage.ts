import type { PeerId } from "@libp2p/interface"
import type { Signature, Message } from "@canvas-js/interfaces"

import { encodeSignedMessage, decodeSignedMessage } from "./schema.js"
import { decodeId, getKey } from "./ids.js"

export type MessageSource = { type: "pubsub" | "push" | "sync"; peer: string }

export class SignedMessage<Payload = unknown> {
	public static decode<Payload = unknown>(
		value: Uint8Array,
		options: { source?: MessageSource } = {},
	): SignedMessage<Payload> {
		const { signature, message } = decodeSignedMessage(value)
		return new SignedMessage<Payload>(signature, message as Message<Payload>, value, options.source)
	}

	public static encode<Payload>(
		signature: Signature,
		message: Message<Payload>,
		options: { source?: MessageSource } = {},
	): SignedMessage<Payload> {
		const value = encodeSignedMessage(signature, message)
		return new SignedMessage(signature, message, value, options.source)
	}

	public readonly id: string
	public readonly key: Uint8Array

	private constructor(
		public readonly signature: Signature,
		public readonly message: Message<Payload>,
		public readonly value: Uint8Array,
		public readonly source?: MessageSource,
	) {
		this.key = getKey(message.clock, value)
		this.id = decodeId(this.key)
	}
}
