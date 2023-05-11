import type { Uint8ArrayList } from "uint8arraylist"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"

import { logger } from "@libp2p/logger"
import type { Stream } from "@libp2p/interface-connection"

import type { Key, Node, Source } from "@canvas-js/okra"

import { Request, IRequest, Response, INode } from "#protocols/sync"
import { assert } from "../utils.js"

export async function* decodeResponses(source: AsyncIterable<Uint8ArrayList>) {
	for await (const msg of source) {
		yield Response.decode(msg.subarray())
	}
}

export async function* encodeRequests(source: AsyncIterable<IRequest>) {
	for await (const msg of source) {
		yield Request.encode(msg).finish()
	}
}

export class Client implements Source {
	private seq = 0
	private readonly responses: AsyncIterator<Response>
	private readonly requests: Pushable<IRequest>
	private readonly log = logger("canvas:sync:client")

	constructor(stream: Stream) {
		this.requests = pushable({ objectMode: true })
		this.responses = pipe(stream.source, lp.decode, decodeResponses)
		pipe(this.requests, encodeRequests, lp.encode, stream.sink).catch((err) => {
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
		assert(getRoot.root, "missing root in getRoot RPC response")
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
		assert(getChildren.children, "missing children in getChildren RPC response")
		return getChildren.children.map(parseNode)
	}

	private async get(req: IRequest): Promise<Response> {
		const seq = this.seq++
		this.requests.push({ ...req, seq })
		const { done, value: res } = await this.responses.next()
		if (done) {
			throw new Error("stream ended prematurely")
		} else if (res.seq !== seq) {
			throw new Error("invalid sequence number in RPC response")
		} else {
			return res
		}
	}
}

function parseNode({ level, key, hash, value }: INode): Node {
	assert(level !== null && level !== undefined)
	assert(hash !== null && hash !== undefined)
	if (value === null || value === undefined) {
		return { level, key: key ?? null, hash }
	} else {
		return { level, key: key ?? null, hash, value }
	}
}
