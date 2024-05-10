// import { Startable, PeerId, Connection, StreamHandler } from "@libp2p/interface"
// import { ConnectionManager, Registrar } from "@libp2p/interface-internal"

// import { Logger, logger } from "@libp2p/logger"

// import PQueue from "p-queue"
// import { pipe } from "it-pipe"
// import * as lp from "it-length-prefixed"
// import { bytesToHex as hex } from "@noble/hashes/utils"
// import { anySignal } from "any-signal"

// import { assert } from "@canvas-js/utils"

// import {
// 	MAX_INBOUND_STREAMS,
// 	MAX_OUTBOUND_STREAMS,
// 	MAX_SYNC_QUEUE_SIZE,
// 	SYNC_RETRY_INTERVAL,
// 	SYNC_RETRY_LIMIT,
// 	second,
// } from "../constants.js"

// import { wait, DelayableController, SyncDeadlockError, SyncTimeoutError } from "../utils.js"

// import { Client, Server, decodeRequests, encodeResponses } from "./index.js"
// import { AbstractGossipLog } from "../AbstractGossipLog.js"

// export interface SyncOptions {
// 	maxInboundStreams?: number
// 	maxOutboundStreams?: number
// }

// export interface SyncServiceComponents {
// 	peerId: PeerId
// 	registrar: Registrar
// 	connectionManager: ConnectionManager
// }

// /**
//  * The SyncService class implements a libp2p syncing service for GossipLog messages.
//  * The service is configured with a global "topic" and takes place over a libp2p protocol
//  * interpolating that topic (`/canvas/sync/v1/${init.topic}`). By default, it schedules
//  * a merkle sync for every new connection with a peer supporting the same topic.
//  */
// export class SyncService<Payload = unknown> implements Startable {
// 	private readonly controller = new AbortController()
// 	private readonly log: Logger
// 	// private readonly protocol: string
// 	private readonly topologyPeers = new Set<string>()

// 	private readonly maxInboundStreams: number
// 	private readonly maxOutboundStreams: number

// 	private readonly syncQueue = new PQueue({ concurrency: 1 })
// 	private readonly syncQueuePeers = new Set<string>()

// 	#registrarId: string | null = null

// 	constructor(
// 		private readonly components: SyncServiceComponents,
// 		private readonly messages: AbstractGossipLog<Payload>,
// 		options: SyncOptions,
// 	) {
// 		this.log = logger(`canvas:gossiplog:[${this.messages.topic}]:sync`)
// 		// this.protocol = getProtocol(messages.topic)

// 		this.maxInboundStreams = options.maxInboundStreams ?? MAX_INBOUND_STREAMS
// 		this.maxOutboundStreams = options.maxOutboundStreams ?? MAX_OUTBOUND_STREAMS
// 	}

// 	public isStarted() {
// 		return this.#registrarId !== null
// 	}

// 	public async start(): Promise<void> {
// 		this.log("starting sync service")

// 		await this.components.registrar.handle(this.protocol, this.handleIncomingStream, {
// 			maxInboundStreams: this.maxInboundStreams,
// 			maxOutboundStreams: this.maxOutboundStreams,
// 		})

// 		this.#registrarId = await this.components.registrar.register(this.protocol, {
// 			notifyOnTransient: false,
// 			onConnect: async (peerId, connection) => {
// 				this.topologyPeers.add(peerId.toString())
// 				this.log("connected to peer %p", peerId)

// 				// having one peer wait an initial randomized interval
// 				// reduces the likelihood of deadlock to near-zero,
// 				// but it could still happen.
// 				if (connection.direction === "inbound") {
// 					const interval = second + Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
// 					this.log("waiting an initial %dms", interval)
// 					await this.wait(interval)
// 				}

// 				this.scheduleSync(peerId)
// 			},

// 			onDisconnect: (peerId) => {
// 				this.log("disconnected from %p", peerId)
// 				this.topologyPeers.delete(peerId.toString())
// 			},
// 		})
// 	}

// 	public async stop(): Promise<void> {
// 		if (this.#registrarId === null) {
// 			return
// 		}

// 		this.log("stopping sync service")

// 		this.controller.abort()

// 		this.syncQueue.clear()
// 		await this.syncQueue.onIdle()

// 		await this.components.registrar.unhandle(this.protocol)
// 		if (this.#registrarId !== null) {
// 			this.components.registrar.unregister(this.#registrarId)
// 			this.#registrarId = null
// 		}
// 	}

// 	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
// 		const peerId = connection.remotePeer
// 		this.log("opened incoming stream %s from peer %p", stream.id, peerId)

// 		const timeoutController = new DelayableController(3 * second)
// 		const signal = anySignal([this.controller.signal, timeoutController.signal])
// 		signal.addEventListener("abort", (err) => {
// 			if (stream.status === "open") {
// 				stream.abort(new Error("TIMEOUT"))
// 			}
// 		})

// 		try {
// 			await this.messages.serve(
// 				async (source) => {
// 					const server = new Server(source)
// 					await pipe(
// 						stream.source,
// 						lp.decode,
// 						decodeRequests,
// 						async function* (reqs) {
// 							for await (const req of reqs) {
// 								timeoutController.delay()
// 								yield req
// 							}
// 						},
// 						(reqs) => server.handle(reqs),
// 						encodeResponses,
// 						lp.encode,
// 						stream.sink,
// 					)
// 				},
// 				{ targetId: peerId.toString() },
// 			)

// 			this.log("closed incoming stream %s from peer %p", stream.id, peerId)
// 		} catch (err) {
// 			if (err instanceof Error && err.message === "TIMEOUT") {
// 				this.log.error("timed out incoming stream %s from peer %p", stream.id, peerId)
// 				stream.abort(err)
// 			} else if (err instanceof Error) {
// 				this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
// 				stream.abort(err)
// 			} else {
// 				this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
// 				stream.abort(new Error("internal error"))
// 			}
// 		} finally {
// 			signal.clear()
// 		}
// 	}

// 	private scheduleSync(peerId: PeerId) {
// 		const id = peerId.toString()
// 		if (this.syncQueuePeers.has(id)) {
// 			this.log("already queued sync with %p", peerId)
// 			return
// 		}

// 		if (this.syncQueue.size >= MAX_SYNC_QUEUE_SIZE) {
// 			this.log("sync queue is full")
// 			return
// 		}

// 		this.syncQueuePeers.add(id)
// 		this.syncQueue
// 			.add(async () => {
// 				if (!this.topologyPeers.has(id)) {
// 					this.log("no longer connected to %s", id)
// 					return
// 				}

// 				const connection = await this.components.connectionManager.openConnection(peerId)
// 				assert(connection !== null, "failed to get connection")

// 				for (let n = 0; n < SYNC_RETRY_LIMIT; n++) {
// 					try {
// 						await this.sync(connection)
// 						return
// 					} catch (err) {
// 						if (err instanceof SyncTimeoutError) {
// 							this.log("merkle sync timed out with %p, waiting to continue", peerId)
// 						} else if (err instanceof SyncDeadlockError) {
// 							this.log("started merkle sync concurrently with %p, retrying to break deadlock", peerId)
// 						} else {
// 							this.log.error("failed to sync with peer: %O", err)
// 						}

// 						if (this.controller.signal.aborted) {
// 							break
// 						} else {
// 							const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
// 							this.log("waiting %dms before trying again (%d/%d)", interval, n + 1, SYNC_RETRY_LIMIT)
// 							await this.wait(interval)
// 							continue
// 						}
// 					}
// 				}

// 				throw new Error("exceeded sync retry limit")
// 			})
// 			.catch((err) => this.log.error("sync failed: %O", err))
// 			.finally(() => this.syncQueuePeers.delete(id))
// 	}

// 	private async sync(connection: Connection): Promise<void> {
// 		const timeoutController = new DelayableController(3 * second)
// 		const signal = anySignal([this.controller.signal, timeoutController.signal])

// 		const peerId = connection.remotePeer
// 		const stream = await connection.newStream(this.protocol).catch((err) => {
// 			this.log.error("failed to open outgoing stream: %O", err)
// 			throw err
// 		})

// 		this.log("opened outgoing stream %s to peer %p", stream.id, peerId)

// 		signal.addEventListener("abort", (err) => {
// 			if (stream.status === "open") {
// 				stream.abort(new Error("TIMEOUT"))
// 			}
// 		})

// 		const client = new Client(stream)
// 		try {
// 			this.log("initiating sync with peer %p", peerId)
// 			const root = await this.messages.write(async (txn) => {
// 				for await (const id of this.messages.sync(txn, peerId.toString(), client)) {
// 					timeoutController.delay()
// 				}

// 				return await txn.messages.getRoot()
// 			})

// 			this.log("committing sync with root hash %s", hex(root.hash))
// 			this.messages.dispatchEvent(new CustomEvent("commit", { detail: { topic: this.messages.topic, root } }))
// 		} finally {
// 			signal.clear()
// 			client.end()
// 			this.log("closed outgoing stream %s to peer %p", stream.id, peerId)
// 		}
// 	}

// 	private async wait(interval: number) {
// 		await wait(interval, { signal: this.controller.signal })
// 	}
// }
