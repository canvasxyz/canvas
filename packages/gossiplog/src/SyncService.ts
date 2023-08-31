import type { PeerId } from "@libp2p/interface-peer-id"
import type { Stream } from "@libp2p/interface-connection"
import type { ConnectionManager } from "@libp2p/interface-connection-manager"
import type { Registrar, StreamHandler, Topology } from "@libp2p/interface-registrar"
import type { Startable } from "@libp2p/interfaces/startable"

import { Logger, logger } from "@libp2p/logger"
import { createTopology } from "@libp2p/topology"

import PQueue from "p-queue"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { bytesToHex as hex } from "@noble/hashes/utils"

import { Client, Server, decodeRequests, encodeResponses } from "./sync/index.js"
import { AbstractMessageLog } from "./store/AbstractStore.js"

import {
	MAX_CONNECTIONS,
	MAX_INBOUND_STREAMS,
	MAX_OUTBOUND_STREAMS,
	MAX_SYNC_QUEUE_SIZE,
	MIN_CONNECTIONS,
	SYNC_COOLDOWN_PERIOD,
	SYNC_RETRY_INTERVAL,
	SYNC_RETRY_LIMIT,
} from "./constants.js"
import { CacheMap, shuffle, sortPair, wait } from "./utils.js"

export interface SyncOptions {
	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export interface SyncServiceComponents {
	peerId: PeerId
	registrar: Registrar
	connectionManager: ConnectionManager
}

/**
 * The SyncService class implements a libp2p syncing service for GossipLog messages.
 * The service is configured with a global "topic" and takes place over a libp2p protocol
 * interpolating that topic (`/canvas/sync/v1/${init.topic}`). By default, it schedules
 * a merkle sync for every new connection with a peer supporting the same topic.
 */
export class SyncService<Payload = unknown, Result = void> implements Startable {
	private readonly protocol: string
	private readonly topology: Topology

	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number

	private readonly minConnections: number
	private readonly maxConnections: number

	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(MAX_SYNC_QUEUE_SIZE)

	#started = false
	#controller = new AbortController()
	#registrarId: string | null = null

	private readonly log: Logger

	constructor(
		private readonly components: SyncServiceComponents,
		private readonly messages: AbstractMessageLog<Payload, Result>,
		options: SyncOptions
	) {
		this.log = logger(`canvas:gossiplog:[${this.topic}]:sync`)
		this.protocol = `/gossiplog/sync/v1/${messages.topic}`

		this.maxInboundStreams = options.maxInboundStreams ?? MAX_INBOUND_STREAMS
		this.maxOutboundStreams = options.maxOutboundStreams ?? MAX_OUTBOUND_STREAMS

		this.minConnections = options.minConnections ?? MIN_CONNECTIONS
		this.maxConnections = options.maxConnections ?? MAX_CONNECTIONS

		this.topology = createTopology({
			min: this.minConnections,
			max: this.maxConnections,

			onConnect: (peerId, connection) => {
				this.topology.peers.add(peerId.toString())
				this.log("new connection %s to peer %p", connection.id, connection.remotePeer)
				this.scheduleSync(connection.remotePeer)
			},

			onDisconnect: (peerId) => {
				this.topology.peers.delete(peerId.toString())
			},
		})
	}

	public isStarted() {
		return this.#started
	}

	public get topic() {
		return this.messages.topic
	}

	public async start(): Promise<void> {
		if (this.#started === true) {
			return
		}

		this.log("starting sync service")

		await this.components.registrar.handle(this.protocol, this.handleIncomingStream, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		this.#registrarId = await this.components.registrar.register(this.protocol, this.topology)
		this.#started = true
	}

	public async stop(): Promise<void> {
		if (this.#started === false) {
			return
		}

		this.log("stopping sync service")

		this.#controller.abort()

		this.syncQueue.clear()
		await this.syncQueue.onIdle()

		await this.components.registrar.unhandle(this.protocol)
		if (this.#registrarId !== null) {
			this.components.registrar.unregister(this.#registrarId)
			this.#registrarId = null
		}

		this.#started = false
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming stream %s from peer %p", stream.id, peerId)

		try {
			await this.messages.serve(peerId, async (source) => {
				const server = new Server(source)
				await pipe(
					stream.source,
					lp.decode,
					decodeRequests,
					(reqs) => server.handle(reqs),
					encodeResponses,
					lp.encode,
					stream.sink
				)
			})

			this.log("closed incoming stream %s from peer %p", stream.id, peerId)
		} catch (err) {
			this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error("internal error"))
			}
		}
	}

	private scheduleSync(peerId: PeerId) {
		const id = peerId.toString()
		if (this.syncQueuePeers.has(id)) {
			this.log("already queued sync with %p", peerId)
			return
		}

		if (this.syncQueue.size >= MAX_SYNC_QUEUE_SIZE) {
			this.log("sync queue is full", this.topic)
			return
		}

		const lastSyncMark = this.syncHistory.get(id)
		if (lastSyncMark !== undefined) {
			const timeSinceLastSync = performance.now() - lastSyncMark
			this.log("last sync with %p was %ds ago", peerId, Math.floor(timeSinceLastSync / 1000))
			if (timeSinceLastSync < SYNC_COOLDOWN_PERIOD) {
				return
			}
		}

		this.syncQueuePeers.add(id)
		this.syncQueue
			.add(async () => {
				// having one peer wait an initial randomized interval
				// reduces the likelihood of deadlock to near-zero,
				// but it could still happen.

				// comment out this block to test the deadlock recovery process.
				const [x, y] = sortPair(this.components.peerId, peerId)
				if (x.equals(this.components.peerId)) {
					const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
					this.log("waiting an initial %dms", interval)
					await this.wait(interval)
				}

				for (let n = 0; n < SYNC_RETRY_LIMIT; n++) {
					try {
						await this.sync(peerId)
						return
					} catch (err) {
						this.log.error("failed to sync with peer: %O", err)

						if (this.#controller.signal.aborted) {
							break
						} else {
							const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
							this.log("waiting %dms before trying again (%d/%d)", interval, n + 1, SYNC_RETRY_LIMIT)
							await this.wait(interval)
							continue
						}
					}
				}

				throw new Error("exceeded sync retry limit")
			})
			.then(() => this.syncHistory.set(id, performance.now()))
			.catch((err) => this.log.error("sync failed: %O", err))
			.finally(() => this.syncQueuePeers.delete(id))
	}

	private async wait(interval: number) {
		await wait(interval, { signal: this.#controller.signal })
	}

	private async sync(peerId: PeerId) {
		this.log("initiating sync with peer %p", peerId)

		const stream = await this.dial(peerId)
		if (stream === null) {
			this.log("failed to dial %p", peerId)
			return
		}

		const client = new Client(stream)

		try {
			const { root } = await this.messages.sync(peerId, client)
			this.log("finished sync, got root hash %s", hex(root.hash))
		} finally {
			client.end()
			this.log("closed outgoing stream %s to peer %p", stream.id, peerId)
		}
	}

	private async dial(peerId: PeerId): Promise<Stream | null> {
		const connections = [...this.components.connectionManager.getConnections(peerId)]
		if (connections.length === 0) {
			this.log("no longer connected to peer %p", peerId)
			return null
		}

		// randomize selected connection
		shuffle(connections)
		for (const connection of connections) {
			this.log("opening outgoing stream on connection %s", connection.id)

			try {
				// TODO: figure out what { signal } does here - is it just for opening the stream or for its entire duration?
				const stream = await connection.newStream(this.protocol)
				this.log("opened outgoing stream %s to peer %p", stream.id, peerId)
				return stream
			} catch (err) {
				this.log.error("failed to open outgoing stream: %O", err)
				continue
			}
		}

		return null
	}
}
