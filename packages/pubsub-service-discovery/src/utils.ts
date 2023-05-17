import * as varint from "big-varint"
import { SignedMessage } from "@libp2p/interface-pubsub"
import { peerIdFromBytes } from "@libp2p/peer-id"
import { Uint8ArrayList } from "uint8arraylist"

import Discovery from "#protocols/discovery"

export const second = 1000
export const minute = 60 * second

export const all = (protocol: string) => true

export class CacheMap<K, V> extends Map<K, V> {
	constructor(public readonly capacity: number, entries?: Iterable<[K, V]>) {
		super(entries)
	}

	public set(key: K, value: V) {
		super.set(key, value)
		for (const key of this.keys()) {
			if (this.size > this.capacity) {
				this.delete(key)
			} else {
				break
			}
		}

		return this
	}
}

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
}

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export function fromSignedMessage(msg: SignedMessage): Discovery.ISignedRecord {
	return {
		from: msg.from.toBytes(),
		data: msg.data,
		seqno: varint.unsigned.encode(msg.sequenceNumber),
		signature: msg.signature,
		key: msg.key,
	}
}

export function toSignedMessage(record: Discovery.ISignedRecord): SignedMessage {
	assert(record.from instanceof Uint8Array, "record.from is missing")
	assert(record.data instanceof Uint8Array, "record.data is missing")
	assert(typeof record.topic === "string", "record.topic is missing")
	assert(record.seqno instanceof Uint8Array, "record.seqno is missing")
	assert(record.signature instanceof Uint8Array, "record.signature is missing")
	assert(record.key instanceof Uint8Array, "record.key is missing")

	return {
		type: "signed",
		from: peerIdFromBytes(record.from),
		data: record.data,
		topic: record.topic,
		sequenceNumber: varint.unsigned.decode(record.seqno),
		signature: record.signature,
		key: record.key,
	}
}

export async function* encodeRequests(source: AsyncIterable<Discovery.IQueryRequest>): AsyncIterable<Uint8Array> {
	for await (const req of source) {
		yield Discovery.QueryRequest.encode(req).finish()
	}
}

export async function* encodeResponses(source: AsyncIterable<Discovery.IQueryResponse>): AsyncIterable<Uint8Array> {
	for await (const res of source) {
		yield Discovery.QueryResponse.encode(res).finish()
	}
}

export async function* decodeRequests(
	source: AsyncIterable<Uint8Array | Uint8ArrayList>
): AsyncIterable<Discovery.QueryRequest> {
	for await (const msg of source) {
		yield Discovery.QueryRequest.decode(msg.subarray())
	}
}

export async function* decodeResponses(
	source: AsyncIterable<Uint8Array | Uint8ArrayList>
): AsyncIterable<Discovery.QueryResponse> {
	for await (const msg of source) {
		yield Discovery.QueryResponse.decode(msg.subarray())
	}
}
