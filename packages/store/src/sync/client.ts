import type { Uint8ArrayList } from "uint8arraylist"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"
import { logger } from "@libp2p/logger"
import type { Stream } from "@libp2p/interface-connection"

import type { Key, Node, Source } from "@canvas-js/okra"

import * as Sync from "#protocols/sync"

import { assert } from "../utils.js"

export async function* decodeResponses(source: AsyncIterable<Uint8ArrayList>) {
	for await (const msg of source) {
		const res = Sync.Response.decode(msg.subarray())
		yield res
	}
}

export async function* encodeRequests(source: AsyncIterable<Sync.IRequest>) {
	for await (const req of source) {
		yield Sync.Request.encode(req).finish()
	}
}

export class Client implements Source {
	private readonly responses: AsyncIterator<Sync.Response, void, undefined>
	private readonly requests: Pushable<Sync.IRequest>
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
		assert(getRoot.root, "missing `root` in getRoot RPC response")
		return parseNode(getRoot.root)
	}

	public async getNode(level: number, key: Key): Promise<Node | null> {
		const { getNode } = await this.get({ getNode: { level, key } })
		assert(getNode, "invalid RPC response type")
		if (getNode.node) {
			return parseNode(getNode.node)
		} else {
			return null
		}
	}

	public async getChildren(level: number, key: Key): Promise<Node[]> {
		const { getChildren } = await this.get({ getChildren: { level, key } })
		assert(getChildren, "invalid RPC response type")
		assert(getChildren.children, "missing `children` in getChildren RPC response")
		const children = getChildren.children.map(parseNode)
		return children
	}

	private async get(req: Sync.IRequest): Promise<Sync.Response> {
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

function parseKey(key: Uint8Array | null | undefined): Key {
	if (key === null || key === undefined || key.length === 0) {
		return null
	} else {
		return key
	}
}

function parseNode({ level, key, hash, value }: Sync.INode): Node {
	assert(level !== null && level !== undefined)
	assert(hash !== null && hash !== undefined)
	if (value === null || value === undefined) {
		return { level, key: parseKey(key), hash }
	} else {
		return { level, key: parseKey(key), hash, value }
	}
}
