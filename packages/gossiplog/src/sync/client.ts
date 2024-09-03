import { CodeError, Stream, TypedEventEmitter } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { pushable, Pushable } from "it-pushable"
import { Uint8ArrayList } from "uint8arraylist"

import type { Key, Node } from "@canvas-js/okra"
import { assert } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"

import { encodeKey, decodeNode } from "./utils.js"
import { SyncServer } from "../interface.js"

export async function* decodeResponses(source: AsyncIterable<Uint8Array | Uint8ArrayList>) {
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

export class Client extends TypedEventEmitter<{ error: CustomEvent<Error> }> implements SyncServer {
	// private readonly responses: AsyncIterator<Sync.Response, void, undefined>
	public readonly requests: Pushable<Sync.Request>
	private readonly log: Logger

	public static codes = {
		ABORT: "ABORT",
	}

	constructor(
		readonly id: string,
		// readonly stream: Duplex<AsyncIterable<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>, Promise<void>>,
		readonly responses: AsyncIterator<Sync.Response, void, undefined>,
	) {
		super()
		this.log = logger(`canvas:sync:client:[${this.id}]`)
		this.requests = pushable({ objectMode: true })
		// this.responses = pipe(stream.source, lp.decode, decodeResponses)

		// pipe(this.requests, encodeRequests, lp.encode, stream.sink).catch((err) => {
		// 	if (err instanceof Error) {
		// 		this.dispatchEvent(new CustomEvent("error", { detail: err }))
		// 	} else {
		// 		console.error(err)
		// 		this.dispatchEvent(new CustomEvent("error", { detail: new Error("internal error") }))
		// 	}
		// })
	}

	public end() {
		this.log("closing")
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
		this.log.trace("req: %O", req)
		this.requests.push(req)

		const { done, value: res } = await this.responses.next()

		if (done) {
			this.log.error("stream %s ended prematurely: %O", this.id, res)
			throw new Error("stream ended prematurely")
		}

		this.log.trace("res: %O", res)
		if (res.abort !== undefined) {
			throw new CodeError("sync aborted by server", Client.codes.ABORT, res.abort)
		}

		return res
	}
}
