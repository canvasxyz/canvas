import type { Uint8ArrayList } from "uint8arraylist"

import { logger } from "@libp2p/logger"

import type { Source } from "@canvas-js/okra"
import { assert } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"

import { encodeNode } from "./utils.js"

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
	readonly log = logger("canvas:sync:server")

	constructor(readonly source: Source) {}

	public async *handle(reqs: AsyncIterable<Sync.Request>): AsyncIterable<Sync.Response> {
		for await (const req of reqs) {
			if (req.getRoot !== undefined) {
				const root = await this.source.getRoot()
				yield { getRoot: { root: encodeNode(root) } }
			} else if (req.getNode !== undefined) {
				const { level, key } = req.getNode
				assert(level !== null && level !== undefined, "missing level in getNode request")
				const node = await this.source.getNode(level, key ?? null)
				if (node === null) {
					yield { getNode: {} }
				} else {
					yield { getNode: { node: encodeNode(node) } }
				}
			} else if (req.getChildren !== undefined) {
				assert(req.getChildren, "missing request body")
				const { level, key } = req.getChildren
				assert(level !== null && level !== undefined, "missing level in getChildren request")
				const children = await this.source.getChildren(level, key ?? null)
				yield { getChildren: { children: children.map(encodeNode) } }
			} else {
				throw new Error("invalid request type")
			}
		}
	}
}
