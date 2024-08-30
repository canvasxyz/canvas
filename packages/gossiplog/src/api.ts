import http from "node:http"
import WebSocket from "ws"
import express from "express"
import { CodeError } from "@libp2p/interface"
import { EventIterator } from "event-iterator"
import { pipe } from "it-pipe"
import { createServer } from "it-ws/server"
import { connect } from "it-ws/client"
import { Pushable, pushable } from "it-pushable"
import { Duplex } from "it-stream-types"

import { assert } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"
import { decodeRequests, encodeResponses, Server } from "./sync/server.js"
import { AbstractGossipLog } from "./AbstractGossipLog.js"
import { Client, decodeResponses, encodeRequests } from "./sync/client.js"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { Logger, logger } from "@libp2p/logger"

function push<T>(sink: Pushable<T>) {
	return async (iter: AsyncIterable<T>) => {
		for await (const item of iter) {
			sink.push(item)
		}
	}
}

function createServerStream<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	log: Logger,
): Duplex<AsyncIterable<Sync.Response>, AsyncIterable<Sync.Request>, void> {
	const source = pushable<Sync.Response>({ objectMode: true })
	const sink = async (iterable: AsyncIterable<Sync.Request>) => {
		const iterator = iterable[Symbol.asyncIterator]()

		for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
			log("got root request: %O", result.value)
			assert(result.value.getRoot !== undefined, "expected initial getRoot request") // TODO: ???
			await gossipLog.serve(async (txn) => {
				const server = new Server(gossipLog.topic, txn)
				pipe(server.source, push(source))
				const res = await server.handleRequest(result.value)
				log("sending root response: %O", res)
				server.source.push(res)
				await server.sink({ [Symbol.asyncIterator]: () => iterator })
			})
		}
	}

	return { sink, source }
}

export function createWebSocketAPI<Payload>(gossipLog: AbstractGossipLog<Payload>) {
	const log = logger(`canvas:gossiplog:[${gossipLog.topic}]:server`)
	return createServer({
		onConnection: (stream) => {
			log("handling new connection")
			pipe(stream.source, decodeRequests, createServerStream(gossipLog, log), encodeResponses, stream.sink)
		},
	})
}

export async function sync<Payload>(gossipLog: AbstractGossipLog<Payload>, addr: string) {
	const stream = connect(addr)
	const responses = pipe(stream, decodeResponses)
	const client = new Client(bytesToHex(randomBytes(4)), responses)
	pipe(client.requests, encodeRequests, stream)
	await gossipLog.sync(client)
	await stream.close()
}

// const WebSocketCodes = {
// 	NORMAL_CLOSURE: 1000,
// 	GOING_AWAY: 1001,
// 	PROTOCOL_ERROR: 1002,
// 	UNSUPPORTED_DATA: 1003,
// 	NO_STATUS_RECEIVED: 1005,
// 	ABNORMAL_CLOSURE: 1006,
// 	INVALID_FRAME_PAYLOAD_DATA: 1007,
// 	POLICY_VIOLATION: 1008,
// 	MESSAGE_TOO_BIG: 1009,
// 	MANDATORY_EXTENSION: 1010,
// 	INTERNAL_SERVER_ERROR: 1011,
// 	SERVICE_RESTART: 1012,
// 	TRY_AGAIN_LATER: 1013,
// 	BAD_GATEWAY: 1014,
// 	TLS_HANDSHAKE: 1015,
// }

// export function createAPI(gossipLog: AbstractGossipLog): http.Server {
// 	const api = express()

// 	api.set("query parser", "simple")

// 	const server = http.createServer(api)

// 	const wss = new WebSocket.Server({ server })

// 	wss.on("connection", async (ws) => {
// 		const startSync = (data: Uint8Array, isBinary: boolean) => {
// 			if (!isBinary) {
// 				return ws.close(WebSocketCodes.UNSUPPORTED_DATA)
// 			}

// 			let req: Sync.Request
// 			try {
// 				req = Sync.Request.decode(data)
// 			} catch (err) {
// 				return ws.close(WebSocketCodes.INVALID_FRAME_PAYLOAD_DATA)
// 			}

// 			gossipLog
// 				.serve(async (txn) => {
// 					const server = new Server(gossipLog.topic, txn)

// 					// setTimeout(() => {}, Server.timeout)

// 					const res = await server.handleRequest(req)
// 					ws.send(Sync.Response.encode(res))

// 					ws.removeListener("message", startSync)

// 					const source = new EventIterator<Sync.Request>(({ push }) => {
// 						const handleMessage = (data: Uint8Array, isBinary: boolean) => {
// 							if (!isBinary) {
// 								return ws.close(WebSocketCodes.UNSUPPORTED_DATA)
// 							}

// 							try {
// 								req = Sync.Request.decode(data)
// 							} catch (err) {
// 								return ws.close(WebSocketCodes.INVALID_FRAME_PAYLOAD_DATA)
// 							}

// 							push(req)
// 						}

// 						ws.on("message", handleMessage)
// 						return () => ws.removeListener("message", handleMessage)
// 					})

// 					const sink = async (iter: AsyncIterable<Sync.Response>) => {
// 						for await (const res of iter) {
// 							ws.send(Sync.Response.encode(res))
// 						}
// 					}

// 					await pipe(source, server, sink)
// 				})
// 				.catch((err) => {
// 					if (err instanceof CodeError && err.code === Client.codes.ABORT) {
// 						ws.removeAllListeners()
// 						ws.on("message", startSync)
// 					} else {
// 						// ...
// 					}
// 				})
// 		}

// 		ws.on("message", startSync)

// 		// Handle WebSocket connection close
// 		ws.on("close", () => {
// 			console.log("Client disconnected")
// 		})
// 	})

// 	return server
// }
