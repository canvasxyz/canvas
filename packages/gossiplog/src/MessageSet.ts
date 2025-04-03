import * as cbor from "microcbor"

import { MessageId } from "./MessageId.js"

export class MessageSet {
	public static decode(bytes: Uint8Array): MessageSet {
		const links = cbor.decode<Uint8Array[]>(bytes)
		return new MessageSet(links.map(MessageId.decode))
	}

	#map = new Map<string, MessageId>()
	public constructor(entries?: Iterable<MessageId>) {
		for (const messageId of entries ?? []) {
			this.add(messageId)
		}
	}

	public has(messageId: MessageId) {
		return this.#map.has(messageId.id)
	}

	public add(messageId: MessageId) {
		this.#map.set(messageId.id, messageId)
	}

	public delete(messageId: MessageId) {
		this.#map.delete(messageId.id)
	}

	public [Symbol.iterator]() {
		return this.#map.values()
	}

	public encode(): Uint8Array {
		const links: Uint8Array[] = []
		for (const messageId of this.#map.values()) {
			links.push(messageId.key)
		}
		return cbor.encode(links)
	}
}
