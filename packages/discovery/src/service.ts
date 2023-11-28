import type { PeerStore } from "@libp2p/interface/peer-store"
import type { Connection } from "@libp2p/interface/connection"
import type { Startable } from "@libp2p/interface/startable"
import type { PeerId } from "@libp2p/interface/peer-id"
import type { Registrar } from "@libp2p/interface-internal/registrar"
import type { ConnectionManager } from "@libp2p/interface-internal/connection-manager"
import { CustomEvent, EventEmitter, TypedEventTarget } from "@libp2p/interface/events"
import { Libp2pEvents } from "@libp2p/interface"
import { PeerDiscovery, PeerDiscoveryEvents, peerDiscovery } from "@libp2p/interface/peer-discovery"

import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { FetchService } from "libp2p/fetch"
import { IdentifyService } from "libp2p/identify"
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record"
import { logger } from "@libp2p/logger"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import * as cbor from "@ipld/dag-cbor"
import PQueue from "p-queue"

import { assert, minute, second } from "./utils.js"
import { TopicCache } from "./cache/interface.js"
import { MemoryCache } from "./cache/MemoryCache.js"

export interface DiscoveryServiceComponents {
	peerId: PeerId
	peerStore: PeerStore
	registrar: Registrar
	connectionManager: ConnectionManager
	events: TypedEventTarget<Libp2pEvents>

	pubsub?: GossipSub
	fetch?: FetchService
}

export interface DiscoveryServiceInit {
	discoveryTopic?: string
	topicFilter?: (topic: string) => boolean

	minPeersPerTopic?: number
	autoDialPriority?: number
	cache?: TopicCache
}

export class DiscoveryService extends EventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, Startable {
	public static FETCH_KEY_PREFIX = "discovery/"

	public static INTERVAL = 5 * minute
	public static DELAY = 10 * second

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
		assert(components.fetch.protocol.startsWith("/canvas/fetch/"))
		return components.fetch
	}

	private readonly pubsub: GossipSub
	private readonly fetch: FetchService

	private readonly log = logger("canvas:discovery")
	private readonly cache: TopicCache
	private readonly minPeersPerTopic: number
	private readonly autoDialPriority: number
	private readonly topicFilter: (topic: string) => boolean

	private readonly topologyPeers = new Set<string>()

	#registrarId: string | null = null
	#queue = new PQueue({ concurrency: 1 })

	constructor(public readonly components: DiscoveryServiceComponents, init: DiscoveryServiceInit) {
		super()
		this.pubsub = DiscoveryService.extractGossipSub(components)
		this.fetch = DiscoveryService.extractFetchService(components)

		this.minPeersPerTopic = init.minPeersPerTopic ?? DiscoveryService.MIN_PEERS_PER_TOPIC
		this.autoDialPriority = init.autoDialPriority ?? DiscoveryService.AUTO_DIAL_PRIORITY
		this.topicFilter = init.topicFilter ?? ((topic) => true)
		this.cache = init.cache ?? new MemoryCache()
	}

	get [peerDiscovery](): PeerDiscovery {
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

		this.#registrarId = await this.components.registrar.register(this.fetch.protocol, {
			onConnect: (peerId: PeerId, connection: Connection) => {
				if (connection.transient) {
					return
				}

				this.topologyPeers.add(peerId.toString())
				this.handleConnect(connection)
			},
			onDisconnect: (peerId: PeerId) => {
				this.topologyPeers.delete(peerId.toString())
			},
		})

		this.components.events.addEventListener("peer:update", ({ detail: { peer, previous } }) => {
			if (peer.peerRecordEnvelope !== undefined && previous?.peerRecordEnvelope === undefined) {
				this.log("received peer record from %s", peer.id)
				this.cache.identify(peer.id, peer.peerRecordEnvelope)
			}
		})

		this.pubsub.addEventListener("subscription-change", ({ detail: { peerId, subscriptions } }) => {
			this.log("subscription change: %s %o", peerId, subscriptions)
			for (const { subscribe, topic } of subscriptions) {
				if (subscribe && this.topicFilter(topic)) {
					this.cache.observe(topic, peerId)
				}
			}
		})
	}

	public async beforeStop(): Promise<void> {
		this.fetch.unregisterLookupFunction(DiscoveryService.FETCH_KEY_PREFIX, this.handleFetch)
		this.#queue.clear()
		await this.#queue.onIdle()
	}

	public async stop(): Promise<void> {
		if (this.#registrarId !== null) {
			this.components.registrar.unregister(this.#registrarId)
			this.#registrarId = null
		}
	}

	private handleFetch = async (key: string): Promise<Uint8Array | null> => {
		if (!key.startsWith(DiscoveryService.FETCH_KEY_PREFIX)) {
			return null
		}

		const topic = key.slice(DiscoveryService.FETCH_KEY_PREFIX.length)
		const results = await this.cache.query(topic)
		return cbor.encode(results.map(({ peerRecordEnvelope }) => peerRecordEnvelope))
	}

	private handleConnect(connection: Connection) {
		this.log("new connection to peer %p", connection.remotePeer)

		this.#queue
			.add(async () => {
				for (const topic of this.pubsub.getTopics().filter(this.topicFilter)) {
					const meshPeers = this.pubsub.getMeshPeers(topic)
					if (meshPeers.length >= this.minPeersPerTopic) {
						continue
					}

					this.log("want more peers for topic %s", topic)

					const key = DiscoveryService.FETCH_KEY_PREFIX + topic
					this.log("fetching key %s from %p", key, connection.remotePeer)
					const result = await this.fetch.fetch(connection.remotePeer, key)
					if (result === null) {
						this.log("got null result")
						continue
					}

					const records = cbor.decode<Uint8Array[]>(result)
					assert(Array.isArray(records), "expected Array.isArray(records)")

					this.log("got %d results", records.length)

					for (const peerRecordEnvelope of records) {
						assert(peerRecordEnvelope instanceof Uint8Array, "expected record instanceof Uint8Array")

						// TODO: consider using components.peerStore.consumePeerRecord instead

						const envelope = await RecordEnvelope.openAndCertify(peerRecordEnvelope, PeerRecord.DOMAIN)
						const { peerId, multiaddrs } = PeerRecord.createFromProtobuf(envelope.payload)
						assert(envelope.peerId.equals(peerId), "expected envelope.peerId.equals(peerId)")

						if (peerId.equals(this.components.peerId)) {
							return
						} else if (meshPeers.includes(peerId.toString())) {
							return
						}

						this.cache.observe(topic, peerId)
						this.cache.identify(peerId, peerRecordEnvelope)

						this.dispatchEvent(new CustomEvent("peer", { detail: { id: peerId, multiaddrs, protocols: [] } }))

						this.log("adding %p to peer store with multiaddrs %o", peerId, multiaddrs)

						await this.components.peerStore.merge(peerId, {
							addresses: multiaddrs.map((multiaddr) => ({ isCertified: true, multiaddr })),
						})

						await this.connect(peerId, multiaddrs)
					}
				}
			})
			.catch((err) => this.log.error("error handling new connection: %O", err))
	}

	private async connect(peerId: PeerId, multiaddrs: Multiaddr[]) {
		const existingConnections = this.components.connectionManager.getConnections(peerId)

		if (existingConnections.length > 0) {
			this.log("already have connection to peer %p", peerId)
			return
		}

		const addrs = multiaddrs.flatMap((ma) => {
			const addr = ma.toString()
			if (addr.endsWith("/webrtc") || addr.endsWith("/ws") || addr.endsWith("/wss")) {
				return [multiaddr(`${addr}/p2p/${peerId}`)]
			} else {
				return []
			}
		})

		this.log("dialing %O", addrs)
		try {
			await this.components.connectionManager.openConnection(addrs, { priority: this.autoDialPriority })
			this.log("connection opened successfully")
		} catch (err) {
			this.log.error("failed to open new connection to %p: %O", peerId, err)
		}
	}
}

export function discovery(
	init: DiscoveryServiceInit = {},
): (components: DiscoveryServiceComponents) => DiscoveryService {
	return (components) => new DiscoveryService(components, init)
}
