import assert from "node:assert"

import type { Uint8ArrayList } from "uint8arraylist"
import type { Duplex, Source } from "it-stream-types"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"

import RPC from "@canvas-js/core/rpc/sync"

import { stringify } from "../utils.js"

import type { ReadOnlyTransaction } from "@canvas-js/core/components/messageStore"
import { equalArrays, fromNode, toKey } from "./utils.js"
import { sha256 } from "@noble/hashes/sha256"

export async function handleIncomingStream(
	stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	txn: ReadOnlyTransaction
) {
	async function* handle(source: Source<Uint8ArrayList>): AsyncIterable<Uint8Array> {
		for await (const msg of source) {
			const req = RPC.Request.decode(msg.subarray())
			const res = await handleRequest(req, txn)
			yield RPC.Response.encode(res).finish()
		}
	}

	await pipe(stream, lp.decode(), handle, lp.encode(), stream)
}

async function handleRequest(req: RPC.Request, txn: ReadOnlyTransaction): Promise<RPC.Response> {
	if (req.request === "getRoot") {
		assert(req.getRoot)
		const root = await txn.getRoot()
		return RPC.Response.create({ seq: req.seq, getRoot: { root: fromNode(root) } })
	} else if (req.request === "getChildren") {
		assert(req.getChildren)
		const { level, key } = RPC.Request.GetChildrenRequest.create(req.getChildren)
		const children = await txn.getChildren(level, toKey(key))
		return RPC.Response.create({ seq: req.seq, getChildren: { nodes: children.map(fromNode) } })
	} else if (req.request === "getMessages") {
		assert(req.getMessages)
		const { ids } = RPC.Request.GetMessagesRequest.create(req.getMessages)
		const encoder = new TextEncoder()
		const messages: Uint8Array[] = []
		for (const id of ids) {
			const message = await txn.getMessage(id)
			const encodedMessage = encoder.encode(stringify(message))
			assert(equalArrays(sha256(encodedMessage), id), "internal error - inconsistent message hash")
			messages.push(encodedMessage)
		}

		return RPC.Response.create({ seq: req.seq, getMessages: { messages } })
	} else {
		throw new Error("invalid request type")
	}
}
