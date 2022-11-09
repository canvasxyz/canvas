import assert from "node:assert"

import chalk from "chalk"

import type { Uint8ArrayList } from "uint8arraylist"
import type { Stream } from "@libp2p/interface-connection"
import type { Source } from "it-stream-types"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"

import * as okra from "node-okra"

import * as RPC from "../../rpc/sync/index.js"

import type { MessageStore } from "../messageStore.js"
import { encodeAction, encodeSession } from "../encoding.js"
import { toBuffer, toHex } from "../utils.js"

export class Server {
	private readonly mst: okra.Tree
	private readonly messageStore: MessageStore

	constructor(init: { mst: okra.Tree; messageStore: MessageStore }) {
		this.mst = init.mst
		this.messageStore = init.messageStore
	}

	public async handleIncomingStream(stream: Stream) {
		const messageStore = this.messageStore
		const txn = new okra.Source(this.mst)

		async function* handle(source: Source<Uint8ArrayList>): AsyncIterable<Uint8Array> {
			for await (const msg of source) {
				const req = RPC.Request.decode(msg.subarray())
				const res = Server.handleRequest(messageStore, txn, req)
				yield RPC.Response.encode(res).finish()
			}
		}

		try {
			await pipe(stream, lp.decode(), handle, lp.encode(), stream)
		} catch (err) {
			console.log(chalk.red(`[canvas-core] Error handling incoming sync:`), err)
		} finally {
			txn.close()
		}
	}

	private static handleRequest(messageStore: MessageStore, txn: okra.Source, req: RPC.Request): RPC.Response {
		switch (req.request) {
			case "getRoot":
				assert(req.getRoot)
				return RPC.Response.create({ seq: req.seq, getRoot: Server.getRoot(txn, req.getRoot) })
			case "getChildren":
				assert(req.getChildren)
				return RPC.Response.create({ seq: req.seq, getChildren: Server.getChildren(txn, req.getChildren) })
			case "getValues":
				assert(req.getValues)
				return RPC.Response.create({ seq: req.seq, getValues: Server.getValues(messageStore, req.getValues) })
			default:
				throw new Error("invalid request type")
		}
	}

	private static getRoot(txn: okra.Source, {}: RPC.Request.IGetRootRequest): RPC.Response.IGetRootResponse {
		return { hash: txn.getRootHash(), level: txn.getRootLevel() }
	}

	private static getChildren(
		txn: okra.Source,
		{ level, leaf }: RPC.Request.IGetChildrenRequest
	): RPC.Response.IGetChildrenResponse {
		assert(typeof level === "number" && level > 0)
		assert(leaf instanceof Uint8Array)
		return { nodes: txn.getChildren(level, toBuffer(leaf)) }
	}

	private static getValues(
		messageStore: MessageStore,
		{ nodes }: RPC.Request.IGetValuesRequest
	): RPC.Response.IGetValuesResponse {
		assert(nodes)
		return {
			values: nodes.map(({ leaf, hash }, i) => {
				assert(leaf instanceof Uint8Array)
				assert(hash instanceof Uint8Array)
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
			}),
		}
	}
}
