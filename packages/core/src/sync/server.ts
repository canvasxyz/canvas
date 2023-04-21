import type { Duplex, Source } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"
import { equals } from "uint8arrays/equals"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"
import { CID } from "multiformats"
import { sha256 } from "@noble/hashes/sha256"

import RPC from "@canvas-js/core/rpc/sync"

import type { ReadOnlyTransaction } from "@canvas-js/core/components/messageStore"

import { stringify, assert } from "@canvas-js/core/utils"
import { fromNode, toKey } from "./utils.js"

export async function handleIncomingStream(
	cid: CID,
	txn: ReadOnlyTransaction,
	stream: Duplex<Source<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>>
) {
	async function* handle(source: Source<Uint8ArrayList>): AsyncIterable<Uint8Array> {
		for await (const msg of source) {
			const req = RPC.Request.decode(msg.subarray())
			try {
				const res = await handleRequest(req, txn)
				yield RPC.Response.encode(res).finish()
			} catch (err) {
				if (err instanceof Error) {
					console.log(`[canvas-core] [${cid}] Error handling incoming RPC request: ${err.message}`, req.toJSON())
				}

				throw err
			}
		}
	}

	await pipe(lp.encode(pipe(lp.decode(stream.source), handle)), stream)
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
			assert(equals(sha256(encodedMessage), id), "internal error - inconsistent message hash")
			messages.push(encodedMessage)
		}

		return RPC.Response.create({ seq: req.seq, getMessages: { messages } })
	} else {
		throw new Error("invalid request type")
	}
}
