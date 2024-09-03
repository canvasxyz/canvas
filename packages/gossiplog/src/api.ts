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
import pDefer, { DeferredPromise } from "p-defer"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { Logger, logger } from "@libp2p/logger"

import { assert } from "@canvas-js/utils"

import * as Sync from "#protocols/sync"
import { decodeRequests, encodeResponses, Server } from "./sync/server.js"
import { AbstractGossipLog } from "./AbstractGossipLog.js"
import { Client, decodeResponses, encodeRequests } from "./sync/client.js"
import { SyncServer } from "./interface.js"

function push<T>(sink: Pushable<T>) {
	const log = logger("canvas:push:sink")
	return async (iter: AsyncIterable<T>) => {
		log("iterating")
		for await (const item of iter) {
			log("item %o", item)
			sink.push(item)
		}
		log("done iterating")
	}
}

async function* fjdksljfkld<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	log: Logger,
	reqs: AsyncIterable<Sync.Request>,
): AsyncIterable<Sync.Response> {
	let session: { deferred: DeferredPromise<void>; server: Server } | null = null
	for await (const req of reqs) {
		if (session === null) {
			session = await new Promise((resolve) =>
				gossipLog.serve((txn) => {
					const deferred = pDefer<void>()
					const server = new Server(gossipLog.topic, txn)
					// pipe(server.source, push(source)).then(() => {
					// 	deferred.resolve()
					// 	session = null
					// })

					resolve({ deferred, server })
					return deferred.promise
				}),
			)
		}

		const { server } = session!
		const res = await server.handleRequest(req)
		yield* server.source
	}
}

function createServerStream<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	log: Logger,
): Duplex<Pushable<Sync.Response>, AsyncIterable<Sync.Request>, void> {
	const source = pushable<Sync.Response>({ objectMode: true })
	const sink = async (iterable: AsyncIterable<Sync.Request>) => {
		let session: { deferred: DeferredPromise<void>; server: Server } | null = null

		for await (const req of iterable) {
			if (session === null) {
				session = await new Promise((resolve) =>
					gossipLog.serve((txn) => {
						const deferred = pDefer<void>()
						const server = new Server(gossipLog.topic, txn)

						pipe(server.source, push(source)).finally(() => {
							deferred.resolve()
							session = null
						})

						resolve({ deferred, server })
						return deferred.promise
					}),
				)
			}

			const { server } = session!

			const res = await server.handleRequest(req)
			server.source.push(res)
		}

		session?.server.source.end()

		// const iterator = iterable[Symbol.asyncIterator]()
		// for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
		// 	log("got root request: %O", result.value)
		// 	assert(result.value.getRoot !== undefined, "expected initial getRoot request") // TODO: ???
		await gossipLog.serve(async (txn) => {
			log("opened transaction")
			const server = new Server(gossipLog.topic, txn)
			const res = await server.handleRequest(result.value)
			log("sending root response: %O", res)
			source.push(res)
			await pipe(
				{
					[Symbol.asyncIterator]: () => ({
						next: async () => {
							log("iterator.next()")
							const result = await iterator.next()
							log("iterator.next(): %o", result)
							return result
						},
					}),
				},
				server,
				push(source),
			)
			// await Promise.all([
			// 	pipe(server.source, push(source)).then(() => log("PIPE IS DONE")),
			// 	server.sink({ [Symbol.asyncIterator]: () => iterator }),
			// ])
			// pipe(server.source, push(source)).then(() => log("PIPE IS DONE"))
			// await server.sink({ [Symbol.asyncIterator]: () => iterator })
			log("closing transaction")
		})
		// }
	}

	return { sink, source }
}

export function createWebSocketAPI<Payload>(gossipLog: AbstractGossipLog<Payload>) {
	const log = logger(`canvas:gossiplog:[${gossipLog.topic}]:api`)
	return createServer({
		onConnection: (stream) => {
			log("handling new connection")
			const server = createServerStream(gossipLog, log)
			pipe(stream.source, decodeRequests, server, encodeResponses, stream.sink).finally(() => server.source.end())
		},
	})
}

export async function sync<Payload>(gossipLog: AbstractGossipLog<Payload>, addr: string) {
	const stream = connect(addr)

	const responses = pipe(stream, decodeResponses)
	let retry = false
	do {
		const client = new Client(bytesToHex(randomBytes(4)), responses)
		pipe(client.requests, encodeRequests, stream)
		try {
			await gossipLog.sync(client)
		} catch (err) {
			if (err instanceof CodeError && err.code === Client.codes.ABORT) {
				retry = true
			} else {
				throw err
			}
		} finally {
			client.end()
		}
	} while (retry)
	await stream.close()
}

const WebSocketCodes = {
	NORMAL_CLOSURE: 1000,
	GOING_AWAY: 1001,
	PROTOCOL_ERROR: 1002,
	UNSUPPORTED_DATA: 1003,
	NO_STATUS_RECEIVED: 1005,
	ABNORMAL_CLOSURE: 1006,
	INVALID_FRAME_PAYLOAD_DATA: 1007,
	POLICY_VIOLATION: 1008,
	MESSAGE_TOO_BIG: 1009,
	MANDATORY_EXTENSION: 1010,
	INTERNAL_SERVER_ERROR: 1011,
	SERVICE_RESTART: 1012,
	TRY_AGAIN_LATER: 1013,
	BAD_GATEWAY: 1014,
	TLS_HANDSHAKE: 1015,
}

export function createAPI(gossipLog: AbstractGossipLog): http.Server {
	const api = express()

	api.set("query parser", "simple")

	const server = http.createServer(api)

	const wss = new WebSocket.Server({ server })

	wss.on("connection", async (ws) => {
		let session: { deferred: DeferredPromise<void>; server: Server } | null = null

		ws.on("message", async (data: Uint8Array, isBinary: boolean) => {
			if (!isBinary) {
				return ws.close(WebSocketCodes.UNSUPPORTED_DATA)
			}

			let req: Sync.Request
			try {
				req = Sync.Request.decode(data)
			} catch (err) {
				return ws.close(WebSocketCodes.INVALID_FRAME_PAYLOAD_DATA)
			}

			if (session === null) {
				session = await new Promise((resolve) =>
					gossipLog.serve((txn) => {
						const deferred = pDefer<void>()
						const server = new Server(gossipLog.topic, txn)
						resolve({ deferred, server })
						return deferred.promise
					}),
				)
			}

			const { server } = session!
			const res = await server.handleRequest(req)
			ws.send(Sync.Response.encode(res))
		})

		const startSync = (data: Uint8Array, isBinary: boolean) => {
			if (!isBinary) {
				return ws.close(WebSocketCodes.UNSUPPORTED_DATA)
			}

			let req: Sync.Request
			try {
				req = Sync.Request.decode(data)
			} catch (err) {
				return ws.close(WebSocketCodes.INVALID_FRAME_PAYLOAD_DATA)
			}

			gossipLog
				.serve(async (txn) => {
					const server = new Server(gossipLog.topic, txn)

					// setTimeout(() => {}, Server.timeout)

					const res = await server.handleRequest(req)
					ws.send(Sync.Response.encode(res))

					ws.removeListener("message", startSync)

					const source = new EventIterator<Sync.Request>(({ push }) => {
						const handleMessage = (data: Uint8Array, isBinary: boolean) => {
							if (!isBinary) {
								return ws.close(WebSocketCodes.UNSUPPORTED_DATA)
							}

							try {
								req = Sync.Request.decode(data)
							} catch (err) {
								return ws.close(WebSocketCodes.INVALID_FRAME_PAYLOAD_DATA)
							}

							push(req)
						}

						ws.on("message", handleMessage)
						return () => ws.removeListener("message", handleMessage)
					})

					const sink = async (iter: AsyncIterable<Sync.Response>) => {
						for await (const res of iter) {
							ws.send(Sync.Response.encode(res))
						}
					}

					await pipe(source, server, sink)
				})
				.catch((err) => {
					if (err instanceof CodeError && err.code === Client.codes.ABORT) {
						ws.removeAllListeners()
						ws.on("message", startSync)
					} else {
						// ...
					}
				})
		}

		ws.on("message", startSync)

		// Handle WebSocket connection close
		ws.on("close", () => {
			console.log("Client disconnected")
		})
	})

	return server
}
