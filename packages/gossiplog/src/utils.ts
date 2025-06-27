import { Uint8ArrayList } from "uint8arraylist"
import * as cbor from "@ipld/dag-cbor"

import { Event } from "@canvas-js/gossiplog/protocols/events"
import { Snapshot } from "@canvas-js/interfaces"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

export const getDHTProtocol = (topic: string) => `/canvas/kad/1.0.0/${topic}`
export const getSyncProtocol = (topic: string) => `/canvas/v1/${topic}/sync`
export const getPushProtocol = (topic: string) => `/canvas/v1/${topic}/push`

export const cborNull: Uint8Array = cbor.encode(null)

// eslint-disable-next-line no-useless-escape
export const topicPattern = /^[a-zA-Z0-9:\.\-]+$/

export function hashSnapshot(snapshot: Snapshot): string {
	const hash = sha256(cbor.encode(snapshot))
	return bytesToHex(hash).slice(0, 16)
}

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
