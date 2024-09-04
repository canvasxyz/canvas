import { CodeError } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { yamux } from "@chainsafe/libp2p-yamux"
import { select, handle } from "@libp2p/multistream-select"

import WebSocket from "it-ws/web-socket"
import { createServer, WebSocketServer } from "it-ws/server"
import { connect } from "it-ws/client"
import { pipe } from "it-pipe"
import { Uint8ArrayList } from "uint8arraylist"

import { AbstractGossipLog } from "./AbstractGossipLog.js"
import { Server } from "./sync/server.js"
import { Client } from "./sync/client.js"

const factory = yamux({})({ logger: { forComponent: logger } })

export const getSyncProtocol = (topic: string) => `/canvas/v1/${topic}/sync`
export const getPushProtocol = (topic: string) => `/canvas/v1/${topic}/push`

async function* chunk(iter: AsyncIterable<Uint8ArrayList | Uint8Array>) {
	for await (const item of iter) {
		yield item.subarray()
	}
}

export async function sync<Payload>(gossipLog: AbstractGossipLog<Payload>, addr: string) {
	const log = logger("canvas:sync:api:client")

	const pushProtocol = getPushProtocol(gossipLog.topic)
	const syncProtocol = getSyncProtocol(gossipLog.topic)

	const muxer = factory.createStreamMuxer({
		direction: "outbound",
		onIncomingStream: (stream) => stream.abort(new Error("incoming stream rejected")),
		onStreamEnd: (stream) => log("stream %s closed", stream.id),
	})

	const ws = connect(addr)
	pipe(ws, muxer, chunk, ws).catch((err) => log.error(err))

	await ws.connected()

	while (ws.socket.readyState == WebSocket.OPEN) {
		const { protocol, stream } = await Promise.resolve(muxer.newStream()).then((stream) =>
			select(stream, syncProtocol, { log: log }),
		)

		const client = new Client(stream)
		try {
			await gossipLog.sync(client)
			break
		} catch (err) {
			if (err instanceof CodeError && err.code === Client.codes.ABORT) {
				continue
			} else {
				throw err
			}
		} finally {
			client.end()
			await stream.close()
		}
	}

	await muxer.close()
	await ws.close()
}

export function createAPI<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	options: { signal?: AbortSignal } = {},
): WebSocketServer {
	const log = logger("canvas:sync:api:server")

	const pushProtocol = getPushProtocol(gossipLog.topic)
	const syncProtocol = getSyncProtocol(gossipLog.topic)

	const muxer = factory.createStreamMuxer({
		direction: "inbound",
		onIncomingStream: (stream) =>
			handle(stream, [pushProtocol, syncProtocol], { log: log }).then(({ protocol, stream }) => {
				log("server: new stream %s with protocol %s", stream.id, protocol)

				if (protocol === syncProtocol) {
					log("creating server...")
					gossipLog.serve((txn) => Server.handleStream(txn, stream)).catch((err) => log(err))
				} else if (protocol === pushProtocol) {
					throw new Error("FJKDSLFJKSLD")
				} else {
					throw new Error("FJKDSLFJKSLD")
				}
			}),

		onStreamEnd: (stream) => log("stream %s closed", stream.id),
	})

	const server = createServer({
		onConnection: (socket) => pipe(socket, muxer, chunk, socket).catch((err) => log.error(err)),
	})

	options?.signal?.addEventListener("abort", async () => {
		await muxer.close()
		await server.close()
	})

	return server
}
