import {
	Libp2pEvents,
	CustomEvent,
	TypedEventEmitter,
	TypedEventTarget,
	PeerId,
	PeerStore,
	Connection,
	Startable,
	PeerDiscovery,
	PeerDiscoveryEvents,
	peerDiscoverySymbol,
} from "@libp2p/interface"

import type { Registrar, ConnectionManager, AddressManager } from "@libp2p/interface-internal"

import { Multiaddr, multiaddr } from "@multiformats/multiaddr"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"

// import { P2P, WebRTC, WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import { Fetch as FetchService } from "@libp2p/fetch"
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record"
import { logger } from "@libp2p/logger"
import { GossipSub, multicodec as gossipSubProtocol } from "@chainsafe/libp2p-gossipsub"
import * as cbor from "@ipld/dag-cbor"
import PQueue from "p-queue"

import { assert, minute, second } from "./utils.js"

export interface DiscoveryServiceComponents {
	peerId: PeerId
	peerStore: PeerStore
	registrar: Registrar
	connectionManager: ConnectionManager
	addressManager: AddressManager
	events: TypedEventTarget<Libp2pEvents>

	pubsub?: GossipSub
	fetch?: FetchService
}

export interface DiscoveryServiceInit {
	addressFilter?: (addr: Multiaddr) => boolean
	topicFilter?: (topic: string) => boolean
	discoveryTopic?: string
	discoveryInterval?: number
	presenceTimeoutInterval?: number
	presenceTimeout?: number

	minPeersPerTopic?: number
	autoDialPriority?: number
}

export type PeerEnv = "browser" | "server"
export type PresenceStore = Record<string, { lastSeen: number; env: PeerEnv }>

export interface DiscoveryServiceEvents extends PeerDiscoveryEvents {
	"peer:topics": CustomEvent<{ peerId: PeerId; topics: string[] }>
	"presence:join": CustomEvent<{ peerId: PeerId; peers: PresenceStore }>
	"presence:leave": CustomEvent<{ peerId: PeerId; peers: PresenceStore }>
}

export class DiscoveryService extends TypedEventEmitter<DiscoveryServiceEvents> implements PeerDiscovery, Startable {
	public static FETCH_KEY_PREFIX = "discovery/"

	public static MIN_PEERS_PER_TOPIC = 5
	public static NEW_CONNECTION_TIMEOUT = 20 * second
	public static NEW_STREAM_TIMEOUT = 10 * second
	public static AUTO_DIAL_PRIORITY = 1

	private static extractGossipSub(components: DiscoveryServiceComponents): GossipSub {
		assert(components.pubsub !== undefined)
		return components.pubsub
	}

	private static extractFetchService(components: DiscoveryServiceComponents): FetchService {
		assert(components.fetch !== undefined)
		return components.fetch
	}

	private readonly pubsub: GossipSub
	private readonly fetch: FetchService

	private readonly log = logger("canvas:discovery")
	private readonly minPeersPerTopic: number
	private readonly autoDialPriority: number
	private readonly topicFilter: (topic: string) => boolean
	private readonly addressFilter: (addr: Multiaddr) => boolean
	private readonly discoveryTopic: string | null
	private readonly discoveryInterval: number
	private readonly presenceTimeout: number
	private readonly presenceTimeoutInterval: number
	private readonly topologyPeers = new Set<string>() // peers we are directly connected to
	private readonly presencePeers: PresenceStore = {}

	readonly #discoveryQueue = new PQueue({ concurrency: 1 })
	readonly #dialQueue = new PQueue({ concurrency: 5 })

	#registrarId: string | null = null
	#heartbeat: NodeJS.Timeout | null = null
	#presenceTimer: NodeJS.Timeout | null = null

	constructor(
		public readonly components: DiscoveryServiceComponents,
		init: DiscoveryServiceInit,
	) {
		super()
		this.pubsub = DiscoveryService.extractGossipSub(components)
		this.fetch = DiscoveryService.extractFetchService(components)

		this.minPeersPerTopic = init.minPeersPerTopic ?? DiscoveryService.MIN_PEERS_PER_TOPIC
		this.autoDialPriority = init.autoDialPriority ?? DiscoveryService.AUTO_DIAL_PRIORITY
		this.topicFilter = init.topicFilter ?? ((topic) => true)
		this.discoveryTopic = init.discoveryTopic ?? null
		this.discoveryInterval = init.discoveryInterval ?? 1 * 60 * 1000 // default to publishing once every minute
		this.presenceTimeoutInterval = init.presenceTimeoutInterval ?? 2.5 * 60 * 1000 // try to evict presence peers every 2m 30s
		this.presenceTimeout = init.presenceTimeout ?? 1.5 * 60 * 1000 // only evict if they haven't published in 1m 30s
		this.addressFilter = init.addressFilter ?? ((addr) => true)
	}

	get [peerDiscoverySymbol](): PeerDiscovery {
		return this
	}

	get [Symbol.toStringTag](): "@canvas-js/discovery" {
		return "@canvas-js/discovery"
	}

	public isStarted(): boolean {
		return this.#registrarId === null
	}

	public async start() {
		this.fetch.registerLookupFunction(DiscoveryService.FETCH_KEY_PREFIX, this.handleFetch)

		this.#registrarId = await this.components.registrar.register(gossipSubProtocol, {
			onConnect: (peerId: PeerId, connection: Connection) => {
				if (connection.transient) {
					return
				}

				this.topologyPeers.add(peerId.toString())
				this.handleConnect(connection)
			},
			onDisconnect: (peerId: PeerId) => {
				this.topologyPeers.delete(peerId.toString())
				delete this.presencePeers[peerId.toString()]
			},
		})
	}

	public async afterStart(): Promise<void> {
		this.log("afterStart", this.discoveryTopic)

		if (this.discoveryTopic !== null) {
			this.pubsub.subscribe(this.discoveryTopic)

			// active discovery
			this.pubsub.addEventListener("message", async ({ detail: message }) => {
				if (message.topic !== this.discoveryTopic) {
					return
				}

				const payload = cbor.decode<{ topics: string[]; peerRecordEnvelope: Uint8Array }>(message.data)
				assert(typeof payload === "object", 'typeof payload === "object"')

				const { topics, peerRecordEnvelope } = payload
				assert(Array.isArray(topics), "expected Array.isArray(topics)")
				assert(peerRecordEnvelope instanceof Uint8Array, "expected peerRecordEnvelope instanceof Uint8Array")
				const { peerId, multiaddrs } = await this.openPeerRecord(peerRecordEnvelope)

				// emit an active discovery event for peers on other topics
				// TODO: also manage a presence set for peers on other topics
				this.log("received heartbeat from %s with topics %o", peerId, topics)
				this.dispatchEvent(new CustomEvent("peer:topics", { detail: { peerId, topics } }))

				const topicIntersection = this.pubsub.getTopics().filter((topic) => topics.includes(topic))
				if (topicIntersection.length === 0) {
					return
				}

				// found a peer via active discovery
				await this.components.peerStore.consumePeerRecord(peerRecordEnvelope, peerId)
				this.dispatchEvent(new CustomEvent("peer", { detail: { id: peerId, multiaddrs, protocols: [] } }))
				this.handlePeerSeen(peerId, multiaddrs)

				for (const topic of topicIntersection) {
					const meshPeers = this.pubsub.getMeshPeers(topic)
					if (meshPeers.length >= this.minPeersPerTopic) {
						continue
					}

					await this.connect(peerId, multiaddrs)
				}
			})

			// publish the heartbeat after the first connection to a peer, and at the heartbeat interval
			this.#heartbeat = setInterval(() => this.publishHeartbeat(), this.discoveryInterval)
			this.components.events.addEventListener(
				"connection:open",
				({ detail: connection }) => {
					setTimeout(() => this.publishHeartbeat(), 1000)
				},
				{ once: true },
			)

			this.#presenceTimer = setInterval(() => {
				Object.entries(this.presencePeers).forEach((peerId, lastSeen) => {
					if (lastSeen < new Date().getTime() - this.presenceTimeout) {
						delete this.presencePeers[peerId.toString()]
						this.dispatchEvent(new CustomEvent("presence:leave", { detail: { peerId, peers: this.presencePeers } }))
					}
				})
			}, this.presenceTimeoutInterval)
		}
	}

	private async publishHeartbeat() {
		this.log("publishing heartbeat")
		if (this.discoveryTopic === null || this.#heartbeat === null) {
			return
		}

		const topics = this.pubsub.getTopics().filter((topic) => this.topicFilter(topic))

		const multiaddrs = this.components.addressManager
			.getAddresses()
			.filter((addr) => !isLoopback(addr) && !isPrivate(addr))

		if (multiaddrs.length === 0) {
			this.log.error("no multiaddrs to publish")
		}

		const peerRecord = new PeerRecord({ multiaddrs, peerId: this.components.peerId })
		const envelope = await RecordEnvelope.seal(peerRecord, this.components.peerId)

		const payload = { topics, peerRecordEnvelope: envelope.marshal() }
		this.pubsub.publish(this.discoveryTopic, cbor.encode(payload)).then(
			({ recipients }) => this.log("published heartbeat to %d recipients", recipients.length),
			(err) => this.log.error("failed to publish heartbeat: %o", err),
		)
	}

	public async beforeStop(): Promise<void> {
		if (this.#heartbeat !== null) {
			clearInterval(this.#heartbeat)
		}

		this.fetch.unregisterLookupFunction(DiscoveryService.FETCH_KEY_PREFIX, this.handleFetch)
		this.#discoveryQueue.clear()
		await this.#discoveryQueue.onIdle()
	}

	public async stop(): Promise<void> {
		if (this.#registrarId !== null) {
			this.components.registrar.unregister(this.#registrarId)
			this.#registrarId = null
		}
	}

	private handleFetch = async (key: string): Promise<Uint8Array | undefined> => {
		if (!key.startsWith(DiscoveryService.FETCH_KEY_PREFIX)) {
			return undefined
		}

		const topic = key.slice(DiscoveryService.FETCH_KEY_PREFIX.length)
		this.log("handling fetch request for peers on topic %s", topic)

		const results = new Map<PeerId, Uint8Array>()
		for (const peerId of this.pubsub.getSubscribers(topic)) {
			const { peerRecordEnvelope } = await this.components.peerStore.get(peerId)
			if (peerRecordEnvelope !== undefined) {
				results.set(peerId, peerRecordEnvelope)
			}
		}

		this.log("found %d subscribers for topic %s: %o", results.size, topic, [...results.keys()])
		return cbor.encode([...results.values()])
	}

	private handleConnect(connection: Connection) {
		this.log("new connection to peer %p", connection.remotePeer)

		this.#discoveryQueue
			.add(async () => {
				for (const topic of this.pubsub.getTopics().filter(this.topicFilter)) {
					const meshPeers = this.pubsub.getMeshPeers(topic)
					if (meshPeers.length >= this.minPeersPerTopic) {
						continue
					}

					this.log("want more peers for topic %s", topic)

					// passive discovery
					const key = DiscoveryService.FETCH_KEY_PREFIX + topic
					this.log("fetching new peers from %p", key, connection.remotePeer)
					const result = await this.fetch.fetch(connection.remotePeer, key)
					if (result === undefined) {
						this.log("no response from %p", connection.remotePeer)
						continue
					}

					const records = cbor.decode<Uint8Array[]>(result)
					assert(Array.isArray(records), "expected Array.isArray(records)")

					this.log("got %d peers via fetch from %p", records.length, connection.remotePeer)

					for (const peerRecordEnvelope of records) {
						assert(peerRecordEnvelope instanceof Uint8Array, "expected record instanceof Uint8Array")

						const { peerId, multiaddrs } = await this.openPeerRecord(peerRecordEnvelope)
						if (peerId.equals(this.components.peerId)) {
							return
						} else if (meshPeers.includes(peerId.toString())) {
							return
						}

						// found a peer via passive discovery
						this.dispatchEvent(new CustomEvent("peer", { detail: { id: peerId, multiaddrs, protocols: [] } }))
						this.handlePeerSeen(peerId, multiaddrs)
						await this.components.peerStore.consumePeerRecord(peerRecordEnvelope, peerId)
						this.#dialQueue.add(() => this.connect(peerId, multiaddrs))
					}
				}
			})
			.catch((err) => this.log.error("error handling new connection: %O", err))
	}

	private async openPeerRecord(envelope: Uint8Array): Promise<{ peerId: PeerId; multiaddrs: Multiaddr[] }> {
		const record = await RecordEnvelope.openAndCertify(envelope, PeerRecord.DOMAIN)
		const { peerId, multiaddrs } = PeerRecord.createFromProtobuf(record.payload)
		assert(record.peerId.equals(peerId), "expected envelope.peerId.equals(peerId)")
		return { peerId, multiaddrs }
	}

	private connect(peerId: PeerId, multiaddrs: Multiaddr[]): Promise<void> {
		if (peerId.equals(this.components.peerId)) {
			this.log("cannot connect to self")
			return Promise.resolve()
		}

		const existingConnections = this.components.connectionManager.getConnections(peerId)

		if (existingConnections.length > 0) {
			// we already have a connection to this peer
			return Promise.resolve()
		}

		const addrs = multiaddrs
			.filter((addr) => this.addressFilter(addr))
			.map((addr) => {
				const ma = addr.toString()
				if (ma.endsWith(`/p2p/${peerId}`)) {
					return addr
				} else {
					return multiaddr(`${ma}/p2p/${peerId}`)
				}
			})

		if (addrs.length === 0) {
			this.log("no dialable addresses")
			return Promise.resolve()
		}

		this.log(
			"dialing %O",
			addrs.map((addr) => addr.toString()),
		)
		return this.components.connectionManager.openConnection(addrs, { priority: this.autoDialPriority }).then(
			() => {
				this.log("connection opened successfully")
			},
			(err) => this.log.error("failed to open new connection to %p: %O", peerId, err),
		)
	}

	private async handlePeerSeen(peerId: PeerId, multiaddrs: Multiaddr[]) {
		const existed = this.presencePeers[peerId.toString()] !== undefined
		this.presencePeers[peerId.toString()] = {
			lastSeen: new Date().getTime(),
			env: multiaddrs.length === 0 ? "browser" : "server",
		}
		if (!existed) {
			this.dispatchEvent(new CustomEvent("presence:join", { detail: { peerId, peers: this.presencePeers } }))
		}
	}
}

export function discovery(
	init: DiscoveryServiceInit = {},
): (components: DiscoveryServiceComponents) => DiscoveryService {
	return (components) => new DiscoveryService(components, init)
}
