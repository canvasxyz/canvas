import { Uint8ArrayList } from "uint8arraylist"

import { Logger, logger } from "@libp2p/logger"

import { assert, SECONDS } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"

import { SyncServer } from "../interface.js"
import { decodeKey, encodeNode } from "./utils.js"
import { pushable } from "it-pushable"

export async function* encodeResponses(responses: AsyncIterable<Sync.Response>): AsyncIterable<Uint8Array> {
	for await (const res of responses) {
		yield Sync.Response.encode(res)
	}
}

export async function* decodeRequests(
	requests: AsyncIterable<Uint8ArrayList | Uint8Array>,
): AsyncIterable<Sync.Request> {
	for await (const msg of requests) {
		const res = Sync.Request.decode(msg.subarray())
		yield res
	}
}

export class Server {
	public static timeout = 10 * SECONDS

	public readonly source = pushable<Sync.Response>({ objectMode: true })

	private readonly signal = AbortSignal.timeout(Server.timeout)
	private readonly log: Logger

	constructor(topic: string, readonly txn: SyncServer) {
		this.log = logger(`canvas:gossiplog:[${topic}]:server`)
		this.signal.addEventListener("abort", () => {
			this.source.push({ abort: { cooldown: 0 } })
			this.source.end()
		})
	}

	public sink = async (reqs: AsyncIterable<Sync.Request>): Promise<void> => {
		for await (const req of reqs) {
			const res = await this.handleRequest(req)
			this.source.push(res)
		}

		this.source.end()
	}

	public async handleRequest(req: Sync.Request): Promise<Sync.Response> {
		if (req.getRoot !== undefined) {
			const root = await this.txn.getRoot()
			return { getRoot: { root: encodeNode(root) } }
		} else if (req.getNode !== undefined) {
			const { level, key } = req.getNode
			assert(level !== null && level !== undefined, "missing level in getNode request")
			const node = await this.txn.getNode(level, decodeKey(key))
			if (node === null) {
				return { getNode: {} }
			} else {
				return { getNode: { node: encodeNode(node) } }
			}
		} else if (req.getChildren !== undefined) {
			const { level, key } = req.getChildren
			assert(level !== null && level !== undefined, "missing level in getChildren request")
			const children = await this.txn.getChildren(level, decodeKey(key))
			return { getChildren: { children: children.map(encodeNode) } }
		} else if (req.getValues !== undefined) {
			const { keys } = req.getValues
			const values = await this.txn.getValues(keys)
			return { getValues: { values } }
		} else {
			throw new Error("invalid request type")
		}
	}
}
