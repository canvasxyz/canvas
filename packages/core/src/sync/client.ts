import assert from "node:assert"

import type { Duplex, Source } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"

import RPC from "@canvas-js/core/rpc/sync"
import type { Node } from "@canvas-js/core/components/messageStore"
import { toNode } from "./utils.js"

export class Client {
	private seq = 0
	private readonly responses: AsyncIterator<RPC.Response>
	private readonly requests: Pushable<RPC.Request>
	constructor({ source, sink }: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>) {
		this.responses = pipe(source, lp.decode(), Client.decodeResponses)
		this.requests = pushable({ objectMode: true })
		pipe(this.requests, Client.encodeRequests, lp.encode(), sink)
	}

	public end() {
		this.requests.end()
	}

	public async getRoot(): Promise<Node> {
		const { getRoot } = await this.get({ getRoot: {} })
		assert(getRoot && getRoot.root, "Invalid RPC response")
		return toNode(RPC.Node.create(getRoot.root))
	}

	public async getChildren(level: number, key: Uint8Array | null): Promise<Node[]> {
		const { getChildren } = await this.get({ getChildren: { level, key } })
		assert(getChildren, "Invalid RPC response")
		const { nodes } = RPC.Response.GetChildrenResponse.create(getChildren)
		return nodes.map(RPC.Node.create).map(toNode)
	}

	public async getMessages(ids: Uint8Array[]): Promise<Uint8Array[]> {
		const { getMessages } = await this.get({ getMessages: { ids } })
		assert(getMessages, "Invalid RPC response")
		const { messages: responses } = RPC.Response.GetMessagesResponse.create(getMessages)
		assert(responses.length === ids.length, "expected responses.length to match requests.length")
		return responses
	}

	private async get(req: RPC.IRequest): Promise<RPC.Response> {
		const seq = this.seq++
		this.requests.push(RPC.Request.create({ ...req, seq }))
		const { done, value: res } = await this.responses.next()
		if (done) {
			throw new Error("Stream ended prematurely")
		} else if (res.seq !== seq) {
			throw new Error("Invalid sequence number in RPC response")
		} else {
			return res
		}
	}

	private static async *decodeResponses(source: Source<Uint8ArrayList>) {
		for await (const msg of source) {
			yield RPC.Response.decode(msg.subarray())
		}
	}

	private static async *encodeRequests(source: Source<RPC.Request>) {
		for await (const msg of source) {
			yield RPC.Request.encode(msg).finish()
		}
	}
}
