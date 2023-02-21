import assert from "node:assert"

import type { Uint8ArrayList } from "uint8arraylist"
import type { Duplex, Source } from "it-stream-types"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"

import type * as okra from "@canvas-js/okra-node"

import RPC from "../../rpc/sync/index.cjs"

import { toBuffer, stringify, signalInvalidType } from "../utils.js"

import { type MessageStore, toKey } from "./utils.js"

const { CANVAS_SESSION, CANVAS_ACTION } = RPC.MessageRequest.MessageType

export async function handleIncomingStream(
	stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	messageStore: MessageStore,
	txn: okra.Transaction
) {
	async function* handle(source: Source<Uint8ArrayList>): AsyncIterable<Uint8Array> {
		for await (const msg of source) {
			const req = RPC.Request.decode(msg.subarray())
			const res = handleRequest(messageStore, txn, req)
			yield RPC.Response.encode(res).finish()
		}
	}

	await pipe(stream, lp.decode(), handle, lp.encode(), stream)
}

function handleRequest(messageStore: MessageStore, txn: okra.Transaction, req: RPC.Request): RPC.Response {
	switch (req.request) {
		case "getRoot":
			assert(req.getRoot)
			return RPC.Response.create({ seq: req.seq, getRoot: getRoot(req.getRoot, txn) })
		case "getChildren":
			assert(req.getChildren)
			return RPC.Response.create({ seq: req.seq, getChildren: getChildren(req.getChildren, txn) })
		case "getMessages":
			assert(req.getMessages)
			return RPC.Response.create({ seq: req.seq, getMessages: getMessages(req.getMessages, messageStore) })
		default:
			throw new Error("invalid request type")
	}
}

function getRoot(req: RPC.Request.IGetRootRequest, txn: okra.Transaction): RPC.Response.IGetRootResponse {
	const { level, hash } = txn.getRoot()
	return { level, hash }
}

function getChildren(
	{ level, key }: RPC.Request.IGetChildrenRequest,
	txn: okra.Transaction
): RPC.Response.IGetChildrenResponse {
	assert(typeof level === "number" && level > 0)
	assert(key instanceof Uint8Array)
	return { nodes: txn.getChildren(level, toKey(key)) }
}

function getMessages(
	{ messages }: RPC.Request.IGetMessagesRequest,
	messageStore: MessageStore
): RPC.Response.IGetMessagesResponse {
	assert(messages)
	const encoder = new TextEncoder()
	return {
		messages: messages.map(RPC.MessageRequest.create).map(({ type, id }) => {
			if (type === CANVAS_SESSION) {
				const session = messageStore.getSessionByHash(toBuffer(id))
				assert(session !== null, "requested session not found in message store")
				return encoder.encode(stringify(session))
			} else if (type === CANVAS_ACTION) {
				const action = messageStore.getActionByHash(toBuffer(id))
				assert(action !== null, "requested action not found in message store")
				return encoder.encode(stringify(action))
			} else {
				signalInvalidType(type)
			}
		}),
	}
}
