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

import PQueue from "p-queue"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"

import { base32 } from "multiformats/bases/base32"
import * as cbor from "@ipld/dag-cbor"

import type { Node } from "@canvas-js/okra"
import type { Signature } from "@canvas-js/signed-cid"
import type { IPLDValue, Message, SignedMessage } from "@canvas-js/interfaces"

import { openStore, AbstractGraphStore } from "#store"

import { Client, Server, decodeRequests, encodeResponses } from "./sync/index.js"
import { ReferenceSet } from "./graph.js"
import { decodeSignedMessage, encodeSignedMessage, getClock } from "./schema.js"
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

export interface GossipLogInit<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void> {
	location: string | null
	topic: string
	apply: GossipLogConsumer<Payload, Result>
	validate?: (value: IPLDValue) => value is Payload

	start?: boolean
	signatures?: boolean
	sequencing?: boolean

	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export type GossipLogConsumer<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void> = (
	key: Uint8Array,
	signature: Signature,
	message: Message<Payload>
) => Awaitable<{ result: Result }>

export type GossipLogEvents = {
	sync: CustomEvent<{ peerId: PeerId; successCount: number; failureCount: number }>
	commit: CustomEvent<{ root: Node }>
}

export class GossipLog<
	Payload extends IPLDValue = IPLDValue,
	Result extends IPLDValue | void = void
> extends EventEmitter<GossipLogEvents> {
	private readonly topic: string
	private readonly protocol: string
	private readonly topology: Topology

	public readonly signatures: boolean
	public readonly sequencing: boolean

	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number

	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(MAX_SYNC_QUEUE_SIZE)

	private readonly log: Logger
	private readonly controller = new AbortController()
	private readonly validate: (message: Message) => message is Message<Payload>
	private readonly apply: GossipLogConsumer<Payload, Result>

	#started = false
	#registrarId: string | null = null

	public static async init<Payload extends IPLDValue = IPLDValue, Result extends IPLDValue | void = void>(
		libp2p: Libp2p<{ pubsub: PubSub<GossipsubEvents> }> | null,
		init: GossipLogInit<Payload, Result>
	) {
		assert(nsidPattern.test(init.topic), "invalid topic: must match [\\-\\.a-z0-9]+")

		const store = await openStore({ topic: init.topic, location: init.location })
		const gossipLog = new GossipLog(libp2p, store, init)
		if (init.start ?? true) {
			await gossipLog.start()
		}

		return gossipLog
	}

	private constructor(
		public readonly libp2p: Libp2p<{ pubsub: PubSub<GossipsubEvents> }> | null,
		private readonly store: AbstractGraphStore,
		init: GossipLogInit<Payload, Result>
	) {
		super()

		this.topic = protocolPrefix + init.topic
		this.protocol = protocolPrefix + init.topic + "/sync"

		assert(this.topic.startsWith(protocolPrefix))
		assert(this.protocol.startsWith(protocolPrefix))
		this.log = logger(`canvas:gossiplog:${init.topic}`)

		this.validate = (message: Message): message is Message<Payload> => {
			return init.validate === undefined || init.validate(message.payload)
		}

		this.apply = init.apply

		this.sequencing = init.sequencing ?? true
		this.signatures = init.signatures ?? true

		this.maxInboundStreams = init.maxInboundStreams ?? MAX_INBOUND_STREAMS
		this.maxOutboundStreams = init.maxOutboundStreams ?? MAX_OUTBOUND_STREAMS

		this.topology = createTopology({
			min: init.minConnections ?? MIN_CONNECTIONS,
			max: init.maxConnections ?? MAX_CONNECTIONS,

			onConnect: (peerId, connection) => {
				this.topology.peers.add(peerId.toString())
				this.handleConnect(connection)
			},

			onDisconnect: (peerId) => {
				this.topology.peers.delete(peerId.toString())
			},
		})
	}

	public isStarted(): boolean {
		return this.#started
	}

	public async start(): Promise<void> {
		this.log("starting")

		if (this.libp2p !== null) {
			assert(this.libp2p.isStarted(), "libp2p not started")
			await this.libp2p.handle(this.protocol, this.handleIncomingStream, {
				maxInboundStreams: this.maxInboundStreams,
				maxOutboundStreams: this.maxOutboundStreams,
			})

			this.#registrarId = await this.libp2p.register(this.protocol, this.topology)

			this.libp2p.services.pubsub.addEventListener("message", this.handleMessage)
			this.libp2p.services.pubsub.subscribe(this.topic)
			this.log("subscribed to", this.topic)
		}

		this.#started = true
	}

	public async stop(): Promise<void> {
		this.log("stopping")
		this.controller.abort()

		if (this.libp2p !== null && this.libp2p.isStarted()) {
			this.libp2p.services.pubsub.removeEventListener("message", this.handleMessage)
			this.libp2p.services.pubsub.unsubscribe(this.topic)

			await this.libp2p.unhandle(this.protocol)
			if (this.#registrarId !== null) {
				this.libp2p.unregister(this.#registrarId)
				this.#registrarId = null
			}
		}

		await this.store.close()
		this.#started = false
	}

	public async create(payload: Payload): Promise<Message<Payload>> {
		const userdata = await this.store.read(async (txn) => txn.getUserdata())
		const parents = (userdata && cbor.decode<Uint8Array[]>(userdata)) ?? []
		const clock = getClock(parents)
		return { clock, parents, payload }
	}

	public async publish(
		signature: Signature,
		message: Message<Payload>
	): Promise<{ key: Uint8Array; result: Result; recipients: Promise<PeerId[]> }> {
		const [key, value] = encodeSignedMessage({ signature, message })
		const id = base32.baseEncode(key)
		this.log("applying message %s", id)

		const { result } = await this.apply(key, signature, message)

		const { root } = await this.store.write(async (txn) => {
			const userdata = await txn.getUserdata()
			const references = new ReferenceSet(userdata && cbor.decode<Uint8Array[]>(userdata))

			await txn.set(key, value)
			references.update(key, message)

			await txn.setUserdata(cbor.encode(references.getParents()))
			const root = await txn.getRoot()
			return { root }
		})

		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))

		if (this.libp2p === null) {
			return { key, result, recipients: Promise.resolve([]) }
		}

		const recipients = this.libp2p.services.pubsub.publish(this.topic, value).then(
			({ recipients }) => {
				this.log("published event to %d recipients", recipients.length)
				return recipients
			},
			(err) => {
				this.log.error("failed to publish event: %O", err)
				return []
			}
		)

		return { key, result, recipients }
	}

	public async get(key: Uint8Array): Promise<SignedMessage<Payload> | null> {
		const signedMessage = await this.store.get(key)
		if (signedMessage === null) {
			return null
		}

		const { signature, message } = signedMessage
		assert(this.validate(message), "invalid message payload")
		return { signature, message }
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<PubSubMessage>) => {
		if (msg.topic !== this.topic) {
			return
		}

		const [key, signature, message] = decodeSignedMessage(msg.data)
		assert(this.validate(message), "invalid message payload")
		const id = base32.baseEncode(key)

		// TODO: check if the message's parents exist, and mempool the message if any don't.
		try {
			this.log("applying message %s", id)
			await this.apply(key, signature, message)
		} catch (err) {
			this.log.error("failed to apply message %s: %O", id, err)
			return
		}

		try {
			const { root } = await this.store.write(async (txn) => {
				const userdata = await txn.getUserdata()
				const references = new ReferenceSet(userdata && cbor.decode(userdata))

				await txn.set(key, msg.data)
				references.update(key, message)

				await txn.setUserdata(cbor.encode(references.getParents()))
				const root = await txn.getRoot()
				return { root }
			})

			this.log("successfully committed event")
			this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
		} catch (err) {
			this.log.error("failed to commit event: %O", err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		const { protocol } = stream.stat
		this.log("opened incoming stream %s from peer %p with protocol %s", stream.id, peerId, protocol)

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
				const { signal } = this.controller

				{
					// having one peer wait an initial randomized interval
					// reduces the likelihood of deadlock to near-zero,
					// but it could still happen.

					// comment out this block to test the deadlock recovery process.
					const [x, y] = sortPair(this.libp2p!.peerId, peerId)
					if (x.equals(this.libp2p!.peerId)) {
						const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
						this.log("waiting an initial %dms", interval)
						await wait(interval, { signal: this.controller.signal })
					}
				}

				for (let n = 0; n < SYNC_RETRY_LIMIT; n++) {
					try {
						await this.sync(peerId)
						return
					} catch (err) {
						this.log.error("failed to sync with peer: %O", err)

						if (signal.aborted) {
							break
						} else {
							const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
							this.log("waiting %dms before trying again (%d/%d)", interval, n + 1, SYNC_RETRY_LIMIT)
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

			const { root } = await this.store.sync(peerId, client, async (key, signature, message) => {
				try {
					assert(this.validate(message), "invalid message payload")
					await this.apply(key, signature, message)
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
