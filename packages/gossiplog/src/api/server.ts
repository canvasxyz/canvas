import { logger } from "@libp2p/logger"
import { handle } from "@libp2p/multistream-select"

import { createServer, WebSocketServer } from "it-ws/server"
import { pipe } from "it-pipe"

import { AbstractGossipLog } from "../AbstractGossipLog.js"
import { Server } from "../sync/server.js"

import { factory, getPushProtocol, getSyncProtocol, chunk } from "./utils.js"

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
