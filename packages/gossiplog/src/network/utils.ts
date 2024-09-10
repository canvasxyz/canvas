import { logger } from "@libp2p/logger"
import { yamux } from "@chainsafe/libp2p-yamux"
import { Uint8ArrayList } from "uint8arraylist"

import { Event } from "#protocols/events"

export const factory = yamux({})({ logger: { forComponent: logger } })

export const getSyncProtocol = (topic: string) => `/canvas/v1/${topic}/sync`
export const getPushProtocol = (topic: string) => `/canvas/v1/${topic}/push`

export async function* chunk(iter: AsyncIterable<Uint8ArrayList | Uint8Array>) {
	for await (const item of iter) {
		yield item.subarray()
	}
}

export async function* decodeEvents(source: AsyncIterable<Uint8Array | Uint8ArrayList>) {
	for await (const msg of source) {
		const event = Event.decode(msg.subarray())
		yield event
	}
}

export async function* encodeEvents(source: AsyncIterable<Event>) {
	for await (const event of source) {
		yield Event.encode(event)
	}
}
