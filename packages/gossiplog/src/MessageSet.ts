import * as cbor from "microcbor"
import { assert, signalInvalidType } from "@canvas-js/utils"

import { MessageId } from "./MessageId.js"

export class MessageSet {
	public static decode(bytes: Uint8Array): MessageSet {
		const links = cbor.decode<Uint8Array[]>(bytes)
		return new MessageSet(links.map(MessageId.decode))
	}

	#map = new Map<string, MessageId>()

	public constructor(entries?: Iterable<MessageId | string | Uint8Array>) {
		for (const messageId of entries ?? []) {
			if (messageId instanceof MessageId) {
				this.add(messageId)
			} else if (messageId instanceof Uint8Array) {
				this.add(MessageId.decode(messageId))
			} else if (typeof messageId === "string") {
				this.add(MessageId.encode(messageId))
			} else {
				signalInvalidType(messageId)
			}
		}
	}

	public get size() {
		return this.#map.size
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

	public max(): MessageId {
		assert(this.#map.size > 0, "empty message set")
		let max: MessageId | null = null
		for (const messageId of this.#map.values()) {
			if (max === null || messageId.id > max.id) {
				max = messageId
			}
		}

		return max!
	}

	public min(): MessageId {
		assert(this.#map.size > 0, "empty message set")
		let min: MessageId | null = null
		for (const messageId of this.#map.values()) {
			if (min === null || messageId.id < min.id) {
				min = messageId
			}
		}

		return min!
	}
}
