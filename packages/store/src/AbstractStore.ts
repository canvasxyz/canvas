import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { Connection, Stream } from "@libp2p/interface-connection"
import type { StreamHandler, Topology } from "@libp2p/interface-registrar"
import type { PubSub, Message } from "@libp2p/interface-pubsub"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import PQueue from "p-queue"
import { equals } from "uint8arrays"
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import { Logger, logger } from "@libp2p/logger"
import { createTopology } from "@libp2p/topology"

import type { Source, Target, KeyValueStore, Node } from "@canvas-js/okra"

import { Driver, Client, Server, decodeRequests, encodeResponses } from "./sync/index.js"
import { CacheMap, assert, protocolPrefix, shuffle, sortPair, wait } from "./utils.js"
import { Encoding, Consumer, Store, StoreEvents, StoreInit, IPLDValue } from "./interface.js"
import { second } from "./constants.js"
import { createDefaultEncoding } from "./encoding.js"

export abstract class AbstractStore<T extends IPLDValue> extends EventEmitter<StoreEvents> implements Store<T> {
	public static MIN_CONNECTIONS = 2
	public static MAX_CONNECTIONS = 10
	public static MAX_INBOUND_STREAMS = 64
	public static MAX_OUTBOUND_STREAMS = 64
	public static MAX_SYNC_QUEUE_SIZE = 8
	public static SYNC_COOLDOWN_PERIOD = 20 * second
	public static SYNC_RETRY_INTERVAL = 3 * second // this is multiplied by Math.random()
	public static SYNC_RETRY_LIMIT = 5

	public readonly libp2p: Libp2p<{ pubsub: PubSub }>
	private readonly codec: Encoding<T>

	private readonly minConnections: number
	private readonly maxConnections: number
	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number

	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(AbstractStore.MAX_SYNC_QUEUE_SIZE)
	private readonly consumers = new Set<Consumer<T>>()

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
	): Promise<{ root: Node }>

	constructor(init: StoreInit<T>) {
		super()

		this.libp2p = init.libp2p
		this.topic = protocolPrefix + init.topic
		this.protocol = protocolPrefix + init.topic + "/sync"
		this.codec = init.encoding ?? createDefaultEncoding<T>()

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

		if (!this.libp2p.isStarted()) {
			await this.libp2p.start()
		}

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

	public async publish(event: T): Promise<{ key: Uint8Array; recipients: number }> {
		const [key, value] = this.codec.encode(event)

		await this.apply(key, event)

		await this.write(null, async (txn) => txn.set(key, value))

		try {
			const { recipients } = await this.libp2p.services.pubsub.publish(this.topic, value)
			this.log("published event to %d recipients", recipients.length)
			return { key, recipients: recipients.length }
		} catch (err) {
			this.log.error("failed to publish event: %O", err)
			return { key, recipients: 0 }
		}
	}

	public async attach(consumer: Consumer<T>, options: { replay?: boolean } = {}) {
		this.consumers.add(consumer)

		if (options.replay ?? false) {
			// TODO: implement replay
		}
	}

	public detach(consumer: Consumer<T>) {
		this.consumers.delete(consumer)
	}

	private async apply(key: Uint8Array, event: T) {
		this.log("applying event %s", this.codec.keyToString(key))
		for (const consumer of this.consumers) {
			await consumer(key, event)
		}
	}

	public async get(key: Uint8Array): Promise<T | null> {
		let value: Uint8Array | null = null
		await this.read(null, async (txn) => {
			const node = await txn.getNode(0, key)
			if (node !== null && node.value !== undefined) {
				value = node.value
			}
		})

		return value && this.codec.decode(value)
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<Message>) => {
		if (msg.type !== "signed" || msg.topic !== this.topic) {
			return
		}

		let entry: [key: Uint8Array, event: T] | null = null

		try {
			entry = this.codec.decode(msg.data)
		} catch (err) {
			this.log.error("failed to decode event: %O", err)
			return
		}

		const [key, event] = entry

		try {
			await this.apply(key, event)
		} catch (err) {
			this.log.error("failed to apply event %s: %O", this.codec.keyToString(key), err)
			return
		}

		try {
			await this.write(null, async (txn) => txn.set(key, msg.data))
			this.log("successfully committed event")
		} catch (err) {
			this.log.error("failed to commit event: %O", err)
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

	private handleConnect = async ({ id, remotePeer }: Connection) => {
		this.log("new connection %s to peer %p", id, remotePeer)
		this.scheduleSync(remotePeer)
	}

	private scheduleSync(peerId: PeerId) {
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

				{
					// TODO: figure out whether this needs to live in the abstract class
					// or just in the browser/memory implementations

					// having one peer wait an initial randomized interval
					// reduces the likelihood of deadlock to near-zero,
					// but it could still happen.

					// comment out this block to test the deadlock recovery process.
					const [x, y] = sortPair(this.libp2p.peerId, peerId)
					if (x.equals(this.libp2p.peerId)) {
						const interval = Math.floor(Math.random() * AbstractStore.SYNC_RETRY_INTERVAL)
						this.log("waiting an initial %dms", interval)
						await wait(interval, { signal: this.controller.signal })
					}
				}

				for (let n = 0; n < AbstractStore.SYNC_RETRY_LIMIT; n++) {
					try {
						await this.sync(peerId)
						return
					} catch (err) {
						this.log.error("failed to sync with peer: %O", err)

						if (signal.aborted) {
							break
						} else {
							const interval = Math.floor(Math.random() * AbstractStore.SYNC_RETRY_INTERVAL)
							this.log("waiting %dms before trying again (%d/%d)", interval, n + 1, AbstractStore.SYNC_RETRY_LIMIT)
							await wait(interval, { signal: this.controller.signal })
							continue
						}
					}
				}

				throw new Error("exceeded sync retry limit")
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
			const { root } = await this.write(peerId, async (txn) => {
				this.log("opened read-write transaction")

				const driver = new Driver(client, txn)
				for await (const [key, value] of driver.sync()) {
					const eventId = this.codec.keyToString(key)
					let entry: [Uint8Array, T] | null = null

					try {
						entry = this.codec.decode(value)
					} catch (err) {
						this.log.error("failed to decode event %s: %O", eventId, err)
						failureCount++
						continue
					}

					const [recoveredKey, event] = entry
					if (!equals(recoveredKey, key)) {
						const recoveredEventId = this.codec.keyToString(recoveredKey)
						this.log.error("key conflict: expected %s, recovered %s", eventId, recoveredEventId)
						continue
					}

					try {
						await this.apply(key, event)
					} catch (err) {
						this.log.error("failed to apply event %s: %O", eventId, err)
						continue
					}

					await txn.set(key, value)
					successCount++
				}

				this.log("committing transaction")
			})

			this.log("finished sync: applied %d events with %d failures", successCount, failureCount)
			this.dispatchEvent(new CustomEvent("sync", { detail: { peerId, root, successCount, failureCount } }))
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
