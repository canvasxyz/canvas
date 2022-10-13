import assert from "node:assert"

import type { Stream } from "@libp2p/interface-connection"
import type { Source } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"

import { toBuffer } from "../utils.js"
import { IRequest, Node, Request, Response } from "@canvas-js/rpc/sync"

export class Client {
	private seq = 0
	private readonly responses: AsyncIterator<Response>
	private readonly requests: Pushable<Request>
	constructor({ source, sink }: Stream) {
		this.responses = pipe(source, lp.decode(), Client.decodeResponses)
		this.requests = pushable({ objectMode: true })
		pipe(this.requests, Client.encodeRequests, lp.encode(), sink)
	}

	public end() {
		this.requests.end()
	}

	public async getRoot() {
		const { getRoot } = await this.get({ getRoot: {} })
		assert(getRoot, "Invalid RPC response")
		const { level, hash } = Response.GetRootResponse.create(getRoot)
		return { level, hash: toBuffer(hash) }
	}

	public async getChildren(level: number, leaf: Uint8Array) {
		const { getChildren } = await this.get({ getChildren: { level, leaf } })
		assert(getChildren, "Invalid RPC response")
		const { nodes } = Response.GetChildrenResponse.create(getChildren)
		return nodes.map(Node.create).map(({ leaf, hash }) => ({ leaf: toBuffer(leaf), hash: toBuffer(hash) }))
	}

	public async getValues(nodes: { leaf: Uint8Array; hash: Uint8Array }[]) {
		const { getValues } = await this.get({ getValues: { nodes } })
		assert(getValues, "Invalid RPC response")
		const { values } = Response.GetValuesResponse.create(getValues)
		return values
	}

	private async get(req: IRequest) {
		const seq = this.seq++
		this.requests.push(Request.create({ ...req, seq }))
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
			yield Response.decode(msg.subarray())
		}
	}

	private static async *encodeRequests(source: Source<Request>) {
		for await (const msg of source) {
			yield Request.encode(msg).finish()
		}
	}
}
