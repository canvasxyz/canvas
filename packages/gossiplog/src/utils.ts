import { Uint8ArrayList } from "uint8arraylist"
import * as cbor from "@ipld/dag-cbor"

import { Event } from "@canvas-js/gossiplog/protocols/events"

export const cborNull: Uint8Array = cbor.encode(null)

// eslint-disable-next-line no-useless-escape
export const topicPattern = /^[a-zA-Z0-9\.\-]+$/

/** Logarithmic clock decay */
export function* getAncestorClocks(clock: number): Iterable<number> {
	let i = 0
	while (true) {
		const ancestor = clock - (1 << i++)
		if (ancestor > 0) {
			yield ancestor
		} else {
			break
		}
	}
}

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
