import type { Uint8ArrayList } from "uint8arraylist"

import { logger } from "@libp2p/logger"

import type { Source } from "@canvas-js/okra"

import Sync from "#protocols/sync"

import { assert } from "../utils.js"

const log = logger("canvas:sync:server")
export async function* encodeResponses(responses: AsyncIterable<Sync.IResponse>): AsyncIterable<Uint8Array> {
	for await (const res of responses) {
		yield Sync.Response.encode(res).finish()
	}
}

export async function* decodeRequests(
	requests: AsyncIterable<Uint8ArrayList | Uint8Array>
): AsyncIterable<Sync.Request> {
	for await (const msg of requests) {
		yield Sync.Request.decode(msg.subarray())
	}
}

export class Server {
	readonly log = logger("canvas:sync:server")

	constructor(readonly source: Source) {}

	public async *handle(reqs: AsyncIterable<Sync.Request>): AsyncIterable<Sync.IResponse> {
		for await (const req of reqs) {
			this.log("handling %s request", req.request)
			if (req.request === "getRoot") {
				assert(req.getRoot, "missing request body")
				const root = await this.source.getRoot()
				yield { seq: req.seq, getRoot: { root } }
			} else if (req.request === "getNode") {
				assert(req.getNode, "missing request body")
				const { level, key } = req.getNode
				assert(level !== null && level !== undefined, "missing level in getNode request")
				const node = await this.source.getNode(level, key ?? null)
				yield { seq: req.seq, getNode: { node } }
			} else if (req.request === "getChildren") {
				assert(req.getChildren, "missing request body")
				const { level, key } = req.getChildren
				assert(level !== null && level !== undefined, "missing level in getChildren request")
				const children = await this.source.getChildren(level, key ?? null)
				yield { seq: req.seq, getChildren: { children } }
			} else {
				throw new Error("invalid request type")
			}
		}
	}
}
