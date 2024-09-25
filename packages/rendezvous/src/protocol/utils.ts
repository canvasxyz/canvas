import { Uint8ArrayList } from "uint8arraylist"

import { Message } from "./message.js"

export async function* decodeMessages(source: AsyncIterable<Uint8Array | Uint8ArrayList>) {
	for await (const msg of source) {
		yield Message.decode(msg.subarray())
	}
}

export async function* encodeMessages(source: AsyncIterable<Message>) {
	for await (const event of source) {
		yield Message.encode(event)
	}
}
