import { CodeError } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { select } from "@libp2p/multistream-select"

import WebSocket from "it-ws/web-socket"
import { connect } from "it-ws/client"
import { pipe } from "it-pipe"

import { AbstractGossipLog } from "../AbstractGossipLog.js"
import * as sync from "../sync/index.js"

import { factory, getPushProtocol, getSyncProtocol, chunk } from "./utils.js"

export class Client<Payload> {
	log = logger("canvas:sync:api:client")

	pushProtocol = getPushProtocol(this.gossipLog.topic)
	syncProtocol = getSyncProtocol(this.gossipLog.topic)

	muxer = factory.createStreamMuxer({
		direction: "outbound",
		onIncomingStream: (stream) => stream.abort(new Error("incoming stream rejected")),
		onStreamEnd: (stream) => this.log("stream %s closed", stream.id),
	})

	ws = connect(this.addr)

	public constructor(readonly gossipLog: AbstractGossipLog<Payload>, readonly addr: string) {}

	public async close() {
		await this.muxer.close()
		await this.ws.close()
	}

	public async sync() {
		pipe(this.ws, this.muxer, chunk, this.ws).catch((err) => this.log.error(err))

		await this.ws.connected()

		while (this.ws.socket.readyState == WebSocket.OPEN) {
			const { protocol, stream } = await Promise.resolve(this.muxer.newStream()).then((stream) =>
				select(stream, this.syncProtocol, { log: this.log }),
			)

			const client = new sync.Client(stream)
			try {
				await this.gossipLog.sync(client)
				break
			} catch (err) {
				if (err instanceof CodeError && err.code === sync.Client.codes.ABORT) {
					continue
				} else {
					throw err
				}
			} finally {
				client.end()
				await stream.close()
			}
		}
	}
}
