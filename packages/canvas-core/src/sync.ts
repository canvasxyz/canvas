import assert from "node:assert"
import { createHash } from "node:crypto"

import type { Stream } from "@libp2p/interface-connection"
import type { Source } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import * as t from "io-ts"
import * as cbor from "microcbor"

import type * as okra from "node-okra"
import type { Action, Session } from "@canvas-js/interfaces"

import type { MessageStore } from "./messages/index.js"
import { uint8ArrayType } from "./codecs.js"
import { signalInvalidType } from "./utils.js"
import { decodeAction, decodeSession, encodeAction, encodeSession } from "./encoding.js"

const codes = {
	GET_ROOT: 0,
	GET_CHILDREN: 1,
	GET_VALUES: 2,
} as const

const requestType = t.union([
	t.type({ seq: t.number, code: t.literal(codes.GET_ROOT) }),
	t.type({
		seq: t.number,
		code: t.literal(codes.GET_CHILDREN),
		level: t.number,
		leaf: t.union([t.null, uint8ArrayType]),
	}),
	t.type({
		seq: t.number,
		code: t.literal(codes.GET_VALUES),
		nodes: t.array(t.type({ leaf: uint8ArrayType, hash: uint8ArrayType })),
	}),
])

const responseType = t.union([
	t.type({ seq: t.number, code: t.literal(codes.GET_ROOT), level: t.number, hash: uint8ArrayType }),
	t.type({
		seq: t.number,
		code: t.literal(codes.GET_CHILDREN),
		nodes: t.array(t.type({ leaf: uint8ArrayType, hash: uint8ArrayType })),
	}),
	t.type({ seq: t.number, code: t.literal(codes.GET_VALUES), values: t.array(uint8ArrayType) }),
])

async function* handleSourceStream(
	requests: AsyncIterable<t.TypeOf<typeof requestType>>,
	source: okra.Source,
	messageStore: MessageStore
): AsyncIterable<t.TypeOf<typeof responseType>> {
	for await (const request of requests) {
		const { code, seq } = request
		if (code === codes.GET_ROOT) {
			const level = source.getRootLevel()
			const hash = source.getRootHash()
			yield { seq, code, level, hash }
		} else if (code === codes.GET_CHILDREN) {
			const leaf = request.leaf && Buffer.from(request.leaf.buffer, request.leaf.byteOffset, request.leaf.byteLength)
			const nodes = source.getChildren(request.level, leaf)
			yield { seq, code, nodes }
		} else if (code === codes.GET_VALUES) {
			const values = request.nodes.map(({ leaf, hash }, i) => {
				const timestamp = toBuffer(leaf).readUintBE(0, 6)
				if (timestamp % 2 === 0) {
					const session = messageStore.getSessionByHash(toBuffer(hash))
					if (session === null) {
						throw new Error(`session not found: ${toHex(hash)}`)
					} else {
						return encodeSession(session)
					}
				} else {
					const action = messageStore.getActionByHash(toBuffer(hash))
					if (action === null) {
						throw new Error(`action not found: ${toHex(hash)}`)
					} else {
						return encodeAction(action)
					}
				}
			})

			yield { seq, code, values }
		} else {
			signalInvalidType(request)
		}
	}
}

export async function handleSource(stream: Stream, source: okra.Source, messageStore: MessageStore) {
	async function* chunks(): AsyncIterable<Uint8Array> {
		for await (const response of handleSourceStream(decode(stream.source, requestType), source, messageStore)) {
			yield cbor.encode(response)
		}
	}

	await stream.sink(chunks())
}

const rpc = {
	async *getRoot(
		iter: AsyncIterator<t.TypeOf<typeof responseType>>,
		seq: number
	): AsyncGenerator<t.TypeOf<typeof requestType>, { level: number; hash: Buffer }> {
		yield { code: codes.GET_ROOT, seq }
		const { value, done } = await iter.next()
		if (done) {
			throw new Error("source stream ended prematurely")
		} else if (value.seq !== seq) {
			throw new Error("got invalid sequence number")
		} else if (value.code !== codes.GET_ROOT) {
			throw new Error("got invalid response code")
		}

		return { level: value.level, hash: toBuffer(value.hash) }
	},

	async *getChildren(
		iter: AsyncIterator<t.TypeOf<typeof responseType>>,
		seq: number,
		level: number,
		leaf: Buffer
	): AsyncGenerator<t.TypeOf<typeof requestType>, { leaf: Buffer; hash: Buffer }[]> {
		yield { code: codes.GET_CHILDREN, seq, level, leaf }
		const { value, done } = await iter.next()
		if (done) {
			throw new Error("source stream ended prematurely")
		} else if (value.seq !== seq) {
			throw new Error("got invalid sequence number")
		} else if (value.code !== codes.GET_CHILDREN) {
			throw new Error("got invalid response code")
		}

		return value.nodes.map(({ leaf, hash }) => ({ leaf: toBuffer(leaf), hash: toBuffer(hash) }))
	},

	async *getValues(
		iter: AsyncIterator<t.TypeOf<typeof responseType>>,
		seq: number,
		nodes: { leaf: Buffer; hash: Buffer }[]
	): AsyncGenerator<t.TypeOf<typeof requestType>, Buffer[]> {
		yield { code: codes.GET_VALUES, seq, nodes }
		const { value, done } = await iter.next()
		if (done) {
			throw new Error("source stream ended prematurely")
		} else if (value.seq !== seq) {
			throw new Error("got invalid sequence number")
		} else if (value.code !== codes.GET_VALUES) {
			throw new Error("got invalid response code")
		}

		return value.values.map(toBuffer)
	},
}

export type Message = ({ type: "session" } & Session) | ({ type: "action" } & Action)

export async function handleTarget(
	stream: Stream,
	target: okra.Target,
	applyBatch: (messages: Iterable<[string, Message]>) => Promise<void>
) {
	const responses = decode(stream.source, responseType)
	const iter = responses[Symbol.asyncIterator]()
	let seq = 0

	async function* enter(
		targetLevel: number,
		sourceLevel: number,
		sourceRoot: Buffer,
		sourceHash: Buffer
	): AsyncIterable<t.TypeOf<typeof requestType>> {
		if (sourceLevel > targetLevel) {
			const children = yield* rpc.getChildren(iter, seq++, sourceLevel, sourceRoot)
			for (const { leaf, hash } of children) {
				yield* enter(targetLevel, sourceLevel - 1, leaf, hash)
			}
		} else {
			yield* scan(sourceLevel, sourceRoot, sourceHash)
		}
	}

	async function* scan(
		level: number,
		sourceRoot: Buffer,
		sourceHash: Buffer
	): AsyncIterable<t.TypeOf<typeof requestType>> {
		const { leaf: targetRoot, hash: targetHash } = target.seek(level, sourceRoot)
		if (targetRoot.equals(sourceRoot) && targetHash.equals(sourceHash)) {
			return
		}

		const nodes = yield* rpc.getChildren(iter, seq++, level, sourceRoot)
		if (level > 1) {
			for (const { leaf, hash } of nodes) {
				yield* scan(level - 1, leaf, hash)
			}
		} else {
			const leaves = target.filter(nodes)
			const values = yield* rpc.getValues(iter, seq++, leaves)
			if (values.length !== leaves.length) {
				throw new Error("expected values.length to match leaves.length")
			}

			const messages: [string, Message][] = []

			for (const [i, { leaf, hash }] of leaves.entries()) {
				const value = values[i]
				if (!createHash("sha256").update(value).digest().equals(hash)) {
					throw new Error(`the value received for ${toHex(hash)} did not match the hash`)
				}

				const timestamp = leaf.readUintBE(0, 6)
				messages.push([
					toHex(hash),
					timestamp % 2 == 0
						? { type: "session", ...decodeSession(value) }
						: { type: "action", ...decodeAction(value) },
				])
			}

			await applyBatch(messages)
		}
	}

	async function* pipe(): AsyncIterable<t.TypeOf<typeof requestType>> {
		const { level: sourceLevel, hash: sourceValue } = yield* rpc.getRoot(iter, seq++)
		const sourceRoot = Buffer.alloc(14)
		yield* enter(target.getRootLevel(), sourceLevel, sourceRoot, sourceValue)
	}

	async function* sink() {
		for await (const request of pipe()) {
			yield cbor.encode(request)
		}
	}

	await stream.sink(sink())
}

async function* streamChunks(source: Source<Uint8ArrayList>): AsyncIterable<Uint8Array> {
	for await (const chunkList of source) {
		for (const chunk of chunkList) {
			yield chunk
		}
	}
}

async function* decode<T extends cbor.CBORValue>(source: Source<Uint8ArrayList>, type: t.Type<T>): AsyncIterable<T> {
	for await (const value of cbor.decodeStream(streamChunks(source))) {
		assert(type.is(value))
		yield value
	}
}

const toBuffer = (array: Uint8Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)

const toHex = (hash: Uint8Array | Buffer) => `0x${(Buffer.isBuffer(hash) ? hash : toBuffer(hash)).toString("hex")}`
