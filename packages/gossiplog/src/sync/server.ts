import { Stream } from "@libp2p/interface"
import { Logger, logger } from "@libp2p/logger"
import { Pushable, pushable } from "it-pushable"
import { Duplex } from "it-stream-types"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { Uint8ArrayList } from "uint8arraylist"

import { assert, SECONDS } from "@canvas-js/utils"
import * as Sync from "@canvas-js/gossiplog/protocols/sync"

import { SyncSnapshot } from "../interface.js"
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

export class Server implements Duplex<Pushable<Sync.Response>, AsyncIterable<Sync.Request>> {
	public static timeout = 2 * SECONDS

	public static async handleStream(txn: SyncSnapshot, stream: Stream) {
		const server = new Server(txn, stream)

		const signal = AbortSignal.timeout(Server.timeout)

		const onAbort = () => server.abort()
		signal.addEventListener("abort", onAbort)

		try {
			await pipe(stream, lp.decode, decodeRequests, server, encodeResponses, lp.encode, stream)
		} catch (err) {
			server.log.error(err)
		} finally {
			signal.removeEventListener("abort", onAbort)
		}
	}

	public readonly source = pushable<Sync.Response>({ objectMode: true })

	public readonly log: Logger

	#ended = false

	private constructor(
		private readonly txn: SyncSnapshot,
		stream: Stream,
	) {
		this.log = logger(`canvas:sync:server:${stream.id}`)
	}

	public abort() {
		this.source.push({ abort: { cooldown: 0 } })
		this.source.end()
	}

	public sink = async (reqs: AsyncIterable<Sync.Request>): Promise<void> => {
		for await (const req of reqs) {
			if (this.#ended) {
				return
			}

			const res = await this.handleRequest(req)
			if (this.#ended) {
				return
			}

			this.source.push(res)
		}

		this.source.end()
	}

	private async handleRequest(req: Sync.Request): Promise<Sync.Response> {
		this.log.trace("handling", req)
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
