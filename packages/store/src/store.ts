import { EventEmitter } from "@libp2p/interfaces/events"
import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { Connection, Stream } from "@libp2p/interface-connection"
import type { StreamHandler, Topology } from "@libp2p/interface-registrar"
import type { PubSub, Message } from "@libp2p/interface-pubsub"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import PQueue from "p-queue"
import { bytesToHex as hex } from "@noble/hashes/utils"

import { Logger, logger } from "@libp2p/logger"
import { createTopology } from "@libp2p/topology"

import type { Source, Target, KeyValueStore } from "@canvas-js/okra"

import { Driver, Client, Server, decodeRequests, encodeResponses } from "./sync/index.js"
import { second } from "./constants.js"
import { CacheMap, Entry, assert, decodeEntry, encodeEntry, shuffle, sortPair, wait } from "./utils.js"

export interface StoreInit {
	topic: string
	apply: (key: Uint8Array, value: Uint8Array) => Promise<void>

	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export interface Store extends EventEmitter<{}> {
	start(): Promise<void>
	stop(): Promise<void>

	insert(key: Uint8Array, value: Uint8Array): Promise<void>
	get(key: Uint8Array): Promise<Uint8Array | null>
}

export const protocolPrefix = "/canvas/v0/store/"

export abstract class AbstractStore extends EventEmitter<{}> implements Store {
	public static MIN_CONNECTIONS = 2
	public static MAX_CONNECTIONS = 10
	public static MAX_INBOUND_STREAMS = 64
	public static MAX_OUTBOUND_STREAMS = 64
	public static MAX_SYNC_QUEUE_SIZE = 8
	public static SYNC_COOLDOWN_PERIOD = 20 * second
	public static SYNC_RETRY_INTERVAL = 3 * second
	public static SYNC_RETRY_LIMIT = 5

	private readonly minConnections: number
	private readonly maxConnections: number
	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number

	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(AbstractStore.MAX_SYNC_QUEUE_SIZE)

	protected readonly log: Logger
	protected readonly controller = new AbortController()
	protected readonly topic: string
	protected readonly protocol: string
	protected readonly topology: Topology

	#registrarId: string | null = null

	protected abstract read(targetPeerId: PeerId | null, callback: (txn: Source) => Promise<void>): Promise<void>
	protected abstract write(
		sourcePeerId: PeerId | null,
		callback: (txn: Target & Pick<KeyValueStore, "get" | "set" | "delete">) => Promise<void>
	): Promise<void>

	constructor(private readonly libp2p: Libp2p<{ pubsub: PubSub }>, private readonly init: StoreInit) {
		super()

		this.topic = protocolPrefix + init.topic
		this.protocol = protocolPrefix + init.topic + "/sync"

		assert(this.topic.startsWith(protocolPrefix))
		assert(this.protocol.startsWith(protocolPrefix))
		this.log = logger(`canvas:store:[${init.topic}]`)

		this.minConnections = init.minConnections ?? AbstractStore.MIN_CONNECTIONS
		this.maxConnections = init.maxConnections ?? AbstractStore.MAX_CONNECTIONS
		this.maxInboundStreams = init.maxInboundStreams ?? AbstractStore.MAX_INBOUND_STREAMS
		this.maxOutboundStreams = init.maxOutboundStreams ?? AbstractStore.MAX_OUTBOUND_STREAMS

		this.topology = createTopology({
			min: this.minConnections,
			max: this.maxConnections,

			onConnect: (peerId, connection) => {
				this.topology.peers.add(peerId.toString())
				this.handleConnect(connection)
			},

			onDisconnect: (peerId) => {
				this.topology.peers.delete(peerId.toString())
			},
		})
	}

	public async start(): Promise<void> {
		this.log("starting")
		this.libp2p.services.pubsub.addEventListener("message", this.handleMessage)
		this.libp2p.services.pubsub.subscribe(this.topic)

		await this.libp2p.handle(this.protocol, this.handleIncomingStream, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		this.#registrarId = await this.libp2p.register(this.protocol, this.topology)
	}

	public async stop(): Promise<void> {
		this.log("stopping")
		this.controller.abort()
		this.libp2p.services.pubsub.removeEventListener("message", this.handleMessage)
		this.libp2p.services.pubsub.unsubscribe(this.topic)

		this.libp2p.unhandle(this.protocol)
		if (this.#registrarId !== null) {
			this.libp2p.unregister(this.#registrarId)
			this.#registrarId = null
		}
	}

	public async insert(key: Uint8Array, value: Uint8Array): Promise<void> {
		await this.init.apply(key, value)
		await this.write(null, async (txn) => txn.set(key, value))
		try {
			const data = encodeEntry({ key, value })
			const { recipients } = await this.libp2p.services.pubsub.publish(this.topic, data)
			this.log("published entry to %d recipients", recipients.length)
		} catch (err) {
			this.log.error("failed to publish entry: %O", err)
		}
	}

	public async get(key: Uint8Array): Promise<Uint8Array | null> {
		let value: Uint8Array | null = null

		await this.read(null, async (txn) => {
			const node = await txn.getNode(0, key)
			if (node !== null && node.value !== undefined) {
				value = node.value
			}
		})

		return value
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<Message>) => {
		if (msg.type !== "signed" || msg.topic !== this.topic) {
			return
		}

		let entry: Entry | null = null
		try {
			entry = decodeEntry(msg.data)
		} catch (err) {
			this.log.error("received invalid insertion record: %O", err)
			return
		}

		const { key, value } = entry

		try {
			await this.init.apply(key, value)
		} catch (err) {
			this.log.error("failed to apply entry: %O", err)
			return
		}

		try {
			await this.write(null, async (txn) => txn.set(key, value))
			this.log("successfully committed entry")
		} catch (err) {
			this.log.error("failed to commit entry: %O", err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		const { protocol } = stream.stat
		this.log("opened incoming stream %s from peer %p with protocol %s", stream.id, peerId, protocol)

		try {
			await this.read(peerId, async (txn) => {
				const server = new Server(txn)
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

	private handleConnect = async (connection: Connection) => {
		const peerId = connection.remotePeer
		this.log("new connection %s to peer %p", connection.id, peerId)

		const id = peerId.toString()
		if (this.syncQueuePeers.has(id)) {
			this.log("already queued sync with %p", peerId)
			return
		}

		if (this.syncQueue.size >= AbstractStore.MAX_SYNC_QUEUE_SIZE) {
			this.log("sync queue is full")
			return
		}

		const lastSyncMark = this.syncHistory.get(id)
		if (lastSyncMark !== undefined) {
			const timeSinceLastSync = performance.now() - lastSyncMark
			this.log("last sync with %p was %ds ago", peerId, Math.floor(timeSinceLastSync / 1000))
			if (timeSinceLastSync < AbstractStore.SYNC_COOLDOWN_PERIOD) {
				return
			}
		}

		this.syncQueuePeers.add(id)
		this.syncQueue
			.add(async () => {
				const { signal } = this.controller
				let interval = Math.floor(Math.random() * AbstractStore.SYNC_RETRY_INTERVAL)

				const [x, y] = sortPair(this.libp2p.peerId, peerId)
				if (x.equals(this.libp2p.peerId)) {
					this.log("waiting an initial %dms", interval)
					await wait(interval, { signal: this.controller.signal })
				}

				for (let n = 0; n < AbstractStore.SYNC_RETRY_LIMIT; n++) {
					try {
						this.log("starting sync using connection %s", connection.id)
						await this.sync(peerId)
						break
					} catch (err) {
						this.log.error("failed to sync with peer: %O", err)

						if (signal.aborted) {
							break
						} else {
							this.log("waiting %dms before trying again (%d/%d)", interval, n + 1, AbstractStore.SYNC_RETRY_LIMIT)
							await wait(interval, { signal: this.controller.signal })
							interval += Math.random() * AbstractStore.SYNC_RETRY_INTERVAL
							continue
						}
					}
				}
			})
			.then(() => this.syncHistory.set(id, performance.now()))
			.catch((err: any) => this.log.error("sync failed: %O", err))
			.finally(() => this.syncQueuePeers.delete(id))
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
			let [successCount, failureCount] = [0, 0]
			await this.write(peerId, async (txn) => {
				this.log("opened read-write transaction")

				const driver = new Driver(client, txn)
				for await (const [key, value] of driver.sync()) {
					this.log("got entry %s: %s", hex(key), hex(value))
					try {
						await this.init.apply(key, value)
					} catch (err) {
						this.log.error("failed to apply entry: %O", err)
						failureCount++
						continue
					}

					successCount++
					await txn.set(key, value)
				}

				this.log("committing transaction")
			})

			this.log("finished sync: applied %d new entries with %d failures", successCount, failureCount)
		} finally {
			client.end()
			this.log("closed outgoing stream %s to peer %p", stream.id, peerId)
		}
	}

	private async dial(peerId: PeerId): Promise<Stream | null> {
		const connections = [...this.libp2p.getConnections(peerId)]
		if (connections.length === 0) {
			this.log("no longer connected to peer %p", peerId)
			return null
		}

		// randomize selected connection
		shuffle(connections)
		for (const [i, connection] of connections.entries()) {
			this.log("opening outgoing stream on connection %s (%d/%d)", connection.id, i + 1, connections.length)
			try {
				const stream = await connection.newStream(this.protocol)
				this.log("opened outgoing stream %s to peer %p with protocol %s", stream.id, peerId, this.protocol)
				return stream
			} catch (err) {
				this.log.error("failed to open outgoing stream: %O", err)
				continue
			}
		}

		return null
	}
}
