import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { Connection, Stream } from "@libp2p/interface-connection"
import type { StreamHandler, Topology } from "@libp2p/interface-registrar"
import type { Message as PubSubMessage } from "@libp2p/interface-pubsub"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { PubSub } from "@libp2p/interface-pubsub"

import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"
import { Logger, logger } from "@libp2p/logger"
import { createTopology } from "@libp2p/topology"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

import PQueue from "p-queue"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import { base32 } from "multiformats/bases/base32"

import type { Node } from "@canvas-js/okra"
import type { Signature } from "@canvas-js/signed-cid"
import type { IPLDValue, Message } from "@canvas-js/interfaces"

import { openStore, AbstractStore, Graph } from "#store"

import { Client, Server, decodeRequests, encodeResponses } from "./sync/index.js"
import { decodeSignedMessage, encodeSignedMessage } from "./schema.js"
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
import { Awaitable, CacheMap, assert, nsidPattern, protocolPrefix, shuffle, sortPair, wait } from "./utils.js"
import { bytesToHex } from "@noble/hashes/utils"

export interface GossipLogInit<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void> {
	location?: string | null
	topic: string
	apply: GossipLogConsumer<Payload, Result>
	validate?: (value: IPLDValue) => value is Payload

	start?: boolean
	signatures?: boolean
	sequencing?: boolean
	merkleSync?: boolean

	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export type GossipLogConsumer<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void> = (
	id: string,
	signature: Signature | null,
	message: Message<Payload>
) => Awaitable<{ result: Result }>

export type GossipLogEvents<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void> = {
	sync: CustomEvent<{ peerId: PeerId; successCount: number; failureCount: number }>
	commit: CustomEvent<{ root: Node }>
	message: CustomEvent<{ id: string; signature: Signature | null; message: Message<Payload>; result: Result }>
}

export class GossipLog<
	Payload extends IPLDValue = IPLDValue,
	Result extends IPLDValue | void = void
> extends EventEmitter<GossipLogEvents<Payload, Result>> {
	private readonly gossipsubTopic: string
	private readonly merkleSyncProtocol: string
	private readonly topology: Topology

	public readonly signatures: boolean
	public readonly sequencing: boolean
	public readonly merkleSync: boolean

	public readonly maxInboundStreams: number
	public readonly maxOutboundStreams: number
	public readonly minConnections: number
	public readonly maxConnections: number

	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(MAX_SYNC_QUEUE_SIZE)

	private readonly validate: (message: Message) => message is Message<Payload>
	private readonly apply: GossipLogConsumer<Payload, Result>

	#started = false
	#controller = new AbortController()
	#registrarId: string | null = null

	public static async init<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void>(
		libp2p: Libp2p<{ pubsub: PubSub<GossipsubEvents> }> | null,
		init: GossipLogInit<Payload, Result>
	) {
		assert(nsidPattern.test(init.topic), "invalid topic: must match [a-z0-9\\-\\.]+")

		const store = await openStore({
			topic: init.topic,
			location: init.location ?? null,
			signatures: init.signatures ?? true,
			sequencing: init.sequencing ?? true,
		})

		const peerId = libp2p?.peerId ?? (await createEd25519PeerId())
		const gossipLog = new GossipLog(peerId, libp2p, store, init)
		if (init.start ?? true) {
			await gossipLog.start()
		}

		return gossipLog
	}

	private readonly logger = logger(`canvas:gossiplog`)
	private readonly prefix: string

	private constructor(
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<{ pubsub: PubSub<GossipsubEvents> }> | null,
		public readonly store: AbstractStore,
		private readonly init: GossipLogInit<Payload, Result>
	) {
		super()
		this.prefix = `[${peerId.toString().slice(-6)}] [${init.topic}]`
		this.gossipsubTopic = protocolPrefix + init.topic
		this.merkleSyncProtocol = protocolPrefix + init.topic + "/sync"

		this.validate = (message: Message): message is Message<Payload> => {
			return init.validate === undefined || init.validate(message.payload)
		}

		this.apply = init.apply

		this.sequencing = init.sequencing ?? true
		this.signatures = init.signatures ?? true
		this.merkleSync = init.merkleSync ?? true

		this.maxInboundStreams = init.maxInboundStreams ?? MAX_INBOUND_STREAMS
		this.maxOutboundStreams = init.maxOutboundStreams ?? MAX_OUTBOUND_STREAMS

		this.minConnections = init.minConnections ?? MIN_CONNECTIONS
		this.maxConnections = init.maxConnections ?? MAX_CONNECTIONS

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

	private log(template: string, ...args: any[]) {
		this.logger("%s " + template, this.prefix, ...args)
	}

	private logError(template: string, ...args: any[]) {
		this.logger.error("%s " + template, this.prefix, ...args)
	}

	public isStarted(): boolean {
		return this.#started
	}

	public async start(): Promise<void> {
		if (this.#started) {
			this.logError("already started")
			return
		}

		this.log("starting")

		this.#controller = new AbortController()

		if (this.libp2p !== null) {
			if (!this.libp2p.isStarted()) {
				await this.libp2p.start()
			}

			await this.libp2p.handle(this.merkleSyncProtocol, this.handleIncomingStream, {
				maxInboundStreams: this.maxInboundStreams,
				maxOutboundStreams: this.maxOutboundStreams,
			})

			this.#registrarId = await this.libp2p.register(this.merkleSyncProtocol, this.topology)

			this.libp2p.services.pubsub.addEventListener("message", this.handleMessage)
			this.libp2p.services.pubsub.subscribe(this.gossipsubTopic)
			this.log("subscribed to", this.gossipsubTopic)
		}

		this.#started = true
	}

	public async stop(): Promise<void> {
		this.log("stopping")
		this.syncQueue.clear()
		await this.syncQueue.onIdle()

		this.#controller.abort()

		if (this.libp2p !== null && this.libp2p.isStarted()) {
			this.libp2p.services.pubsub.removeEventListener("message", this.handleMessage)
			this.libp2p.services.pubsub.unsubscribe(this.gossipsubTopic)

			await this.libp2p.unhandle(this.merkleSyncProtocol)
			if (this.#registrarId !== null) {
				this.libp2p.unregister(this.#registrarId)
				this.#registrarId = null
			}
		}

		await this.store.close()
		this.#started = false
	}

	public async create(payload: Payload): Promise<Message<Payload>> {
		if (this.sequencing === false) {
			return { clock: 0, parents: [], payload }
		}

		const graph = await this.store.read((txn) => Graph.import(txn))
		const [clock, parents] = graph.export()
		return { clock, parents, payload }
	}

	public async publish(
		signature: Signature | null,
		message: Message<Payload>
	): Promise<{ id: string; result: Result; recipients: Promise<PeerId[]> }> {
		const [key, value] = encodeSignedMessage(signature, message, {
			sequencing: this.sequencing,
			signatures: this.signatures,
		})

		const id = base32.baseEncode(key)
		this.log("publishing message %s", id)

		const { result } = await this.apply(id, signature, message)
		this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))
		this.log("applied message %s and got result %o", id, result)

		const { root } = await this.store.write(async (txn) => {
			const graph = await Graph.import(txn)
			await txn.set(key, value)
			graph.update(key, message)
			await graph.save(txn)
			const root = await txn.getRoot()
			return { root }
		})

		this.log("committed root %s", bytesToHex(root.hash))
		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))

		if (this.libp2p === null) {
			return { id, result, recipients: Promise.resolve([]) }
		}

		const recipients = this.libp2p.services.pubsub.publish(this.gossipsubTopic, value).then(
			({ recipients }) => {
				this.log("published message %s to %d recipients %O", id, recipients.length, recipients)
				return recipients
			},
			(err) => {
				this.logError("failed to publish event: %O", err)
				return []
			}
		)

		return { id, result, recipients }
	}

	public async get(id: string): Promise<[signature: Signature | null, message: Message<Payload> | null]> {
		const [signature, message] = await this.store.get(base32.baseDecode(id))
		if (message === null) {
			return [null, null]
		}

		assert(this.validate(message), "invalid message payload")
		return [signature, message]
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<PubSubMessage>) => {
		if (msg.topic !== this.gossipsubTopic) {
			return
		}

		const [key, signature, message] = decodeSignedMessage(msg.data, {
			sequencing: this.sequencing,
			signatures: this.signatures,
		})

		assert(this.validate(message), "invalid message payload")
		const id = base32.baseEncode(key)

		this.log("received message %s via gossipsub", id)

		// TODO: check if the message's parents exist, and mempool the message if any don't.
		try {
			const { result } = await this.apply(id, signature, message)
			this.log("applied message %s and got result %o", id, result)
			this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))
		} catch (err) {
			this.logError("failed to apply message %s: %O", id, err)
			return
		}

		try {
			const { root } = await this.store.write(async (txn) => {
				const graph = await Graph.import(txn)
				await txn.set(key, msg.data)
				graph.update(key, message)
				await graph.save(txn)
				const root = await txn.getRoot()
				return { root }
			})

			this.log("committed new root %s", bytesToHex(root.hash))
			this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
		} catch (err) {
			this.logError("failed to commit event: %O", err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming stream %s from peer %p", stream.id, peerId)

		try {
			await this.store.source(peerId, async (source) => {
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
			this.logError("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
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
		if (!this.merkleSync) {
			return
		}

		const id = peerId.toString()
		if (this.syncQueuePeers.has(id)) {
			this.log("already queued sync with %p", peerId)
			return
		}

		if (this.syncQueue.size >= MAX_SYNC_QUEUE_SIZE) {
			this.log("sync queue is full")
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
				const [x, y] = sortPair(this.libp2p!.peerId, peerId)
				if (x.equals(this.libp2p!.peerId)) {
					const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
					this.log("waiting an initial %dms", interval)
					await this.wait(interval)
				}

				for (let n = 0; n < SYNC_RETRY_LIMIT; n++) {
					try {
						await this.sync(peerId)
						return
					} catch (err) {
						this.logError("failed to sync with peer: %O", err)

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
			.catch((err: any) => this.logError("sync failed: %O", err))
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
			let [successCount, failureCount] = [0, 0]

			const { root } = await this.store.sync(peerId, client, async (key, signature, message) => {
				const id = base32.baseEncode(key)
				this.log("received message %s via merkle sync", id)
				try {
					assert(this.validate(message), "invalid message payload")
					const { result } = await this.apply(id, signature, message)
					this.log("applied message %s and got result %o", id, result)
					this.dispatchEvent(new CustomEvent("message", { detail: { id, signature, message, result } }))
					successCount++
				} catch (err) {
					failureCount++
					throw err
				}
			})

			this.log("finished sync: applied %d events with %d failures", successCount, failureCount)
			this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
			this.dispatchEvent(new CustomEvent("sync", { detail: { peerId, successCount, failureCount } }))
		} finally {
			client.end()
			this.log("closed outgoing stream %s to peer %p", stream.id, peerId)
		}
	}

	private async dial(peerId: PeerId): Promise<Stream | null> {
		const connections = [...this.libp2p!.getConnections(peerId)]
		if (connections.length === 0) {
			this.log("no longer connected to peer %p", peerId)
			return null
		}

		// randomize selected connection
		shuffle(connections)
		for (const [i, connection] of connections.entries()) {
			this.log("opening outgoing stream on connection %s (%d/%d)", connection.id, i + 1, connections.length)
			try {
				const stream = await connection.newStream(this.merkleSyncProtocol)
				this.log("opened outgoing stream %s to peer %p with protocol %s", stream.id, peerId, this.merkleSyncProtocol)
				return stream
			} catch (err) {
				this.logError("failed to open outgoing stream: %O", err)
				continue
			}
		}

		return null
	}
}
