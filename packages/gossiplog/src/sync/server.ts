import { Uint8ArrayList } from "uint8arraylist"

import { Logger, logger } from "@libp2p/logger"

import { assert } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"

import { SyncServer } from "../interface.js"
import { decodeKey, encodeNode } from "./utils.js"

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
	private readonly log: Logger

	constructor(topic: string, readonly source: SyncServer) {
		this.log = logger(`canvas:gossiplog:[${topic}]:server`)
	}

	public async *handle(reqs: AsyncIterable<Sync.Request>): AsyncIterable<Sync.Response> {
		for await (const req of reqs) {
			if (req.getRoot !== undefined) {
				const root = await this.source.getRoot()
				yield { getRoot: { root: encodeNode(root) } }
			} else if (req.getNode !== undefined) {
				const { level, key } = req.getNode
				assert(level !== null && level !== undefined, "missing level in getNode request")
				const node = await this.source.getNode(level, decodeKey(key))
				if (node === null) {
					yield { getNode: {} }
				} else {
					yield { getNode: { node: encodeNode(node) } }
				}
			} else if (req.getChildren !== undefined) {
				const { level, key } = req.getChildren
				assert(level !== null && level !== undefined, "missing level in getChildren request")
				const children = await this.source.getChildren(level, decodeKey(key))
				yield { getChildren: { children: children.map(encodeNode) } }
			} else if (req.getValues !== undefined) {
				const { keys } = req.getValues
				const values = await this.source.getValues(keys)
				yield { getValues: { values } }
			} else {
				throw new Error("invalid request type")
			}
		}
	}
}
