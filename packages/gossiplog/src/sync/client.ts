import { Stream } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"
import { Uint8ArrayList } from "uint8arraylist"

import type { Key, Node } from "@canvas-js/okra"
import { assert } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"

import { encodeKey, decodeNode } from "./utils.js"
import { SyncServer } from "../interface.js"

export async function* decodeResponses(source: AsyncIterable<Uint8ArrayList>) {
	for await (const msg of source) {
		const res = Sync.Response.decode(msg.subarray())
		yield res
	}
}

export async function* encodeRequests(source: AsyncIterable<Sync.Request>) {
	for await (const req of source) {
		yield Sync.Request.encode(req)
	}
}

export class Client implements SyncServer {
	private readonly responses: AsyncIterator<Sync.Response, void, undefined>
	private readonly requests: Pushable<Sync.Request>
	private readonly log = logger("canvas:sync:client")

	constructor(readonly stream: Stream) {
		this.requests = pushable({ objectMode: true })
		this.responses = pipe(stream, lp.decode, decodeResponses)
		pipe(this.requests, encodeRequests, lp.encode, stream).catch((err) => {
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error("internal error"))
			}
		})
	}

	public end() {
		this.requests.end()
	}

	public async getRoot(): Promise<Node> {
		const { getRoot } = await this.get({ getRoot: {} })
		assert(getRoot, "invalid RPC response type")
		assert(getRoot.root !== undefined, "missing `root` in getRoot RPC response")
		return decodeNode(getRoot.root)
	}

	public async getNode(level: number, key: Key): Promise<Node | null> {
		const { getNode } = await this.get({ getNode: { level, key: encodeKey(key) } })
		assert(getNode, "invalid RPC response type")
		if (getNode.node) {
			return decodeNode(getNode.node)
		} else {
			return null
		}
	}

	public async getChildren(level: number, key: Key): Promise<Node[]> {
		const { getChildren } = await this.get({ getChildren: { level, key: encodeKey(key) } })
		assert(getChildren, "invalid RPC response type")
		return getChildren.children.map(decodeNode)
	}
	public async getValues(keys: Uint8Array[]): Promise<Uint8Array[]> {
		const { getValues } = await this.get({ getValues: { keys } })
		assert(getValues, "invalid RPC response type")
		return getValues.values
	}

	private async get(req: Sync.Request): Promise<Sync.Response> {
		this.requests.push(req)
		const { done, value: res } = await this.responses.next()
		if (done) {
			this.log.error("stream %s ended prematurely: %O", this.stream.id, res)
			throw new Error("stream ended prematurely")
		} else {
			return res
		}
	}
}
