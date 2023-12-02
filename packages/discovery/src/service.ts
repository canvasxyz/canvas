import type { PeerStore } from "@libp2p/interface/peer-store"
import type { Connection } from "@libp2p/interface/connection"
import type { Startable } from "@libp2p/interface/startable"
import type { PeerId } from "@libp2p/interface/peer-id"
import type { Registrar } from "@libp2p/interface-internal/registrar"
import type { ConnectionManager } from "@libp2p/interface-internal/connection-manager"
import type { AddressManager } from "@libp2p/interface-internal/address-manager"
import { CustomEvent, EventEmitter, TypedEventTarget } from "@libp2p/interface/events"
import { Libp2pEvents } from "@libp2p/interface"
import { PeerDiscovery, PeerDiscoveryEvents, peerDiscovery } from "@libp2p/interface/peer-discovery"

import { Multiaddr } from "@multiformats/multiaddr"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { P2P, WebRTC, WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import { FetchService } from "libp2p/fetch"
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record"
import { logger } from "@libp2p/logger"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
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
	topicFilter?: (topic: string) => boolean
	discoveryTopic?: string
	discoveryInterval?: number

	minPeersPerTopic?: number
	autoDialPriority?: number
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
	private readonly minPeersPerTopic: number
	private readonly autoDialPriority: number
	private readonly topicFilter: (topic: string) => boolean
	private readonly discoveryTopic: string | null
	private readonly discoveryInterval: number
	private readonly topologyPeers = new Set<string>()

	readonly #discoveryQueue = new PQueue({ concurrency: 1 })
	readonly #dialQueue = new PQueue({ concurrency: 5 })

	#registrarId: string | null = null
	#heartbeat: NodeJS.Timeout | null = null

	constructor(public readonly components: DiscoveryServiceComponents, init: DiscoveryServiceInit) {
		super()
		this.pubsub = DiscoveryService.extractGossipSub(components)
		this.fetch = DiscoveryService.extractFetchService(components)

		this.minPeersPerTopic = init.minPeersPerTopic ?? DiscoveryService.MIN_PEERS_PER_TOPIC
		this.autoDialPriority = init.autoDialPriority ?? DiscoveryService.AUTO_DIAL_PRIORITY
		this.topicFilter = init.topicFilter ?? ((topic) => true)
		this.discoveryTopic = init.discoveryTopic ?? null
		this.discoveryInterval = init.discoveryInterval ?? 1 * 60 * 1000 // default to publishing once every minute
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
	}

	public async afterStart(): Promise<void> {
		this.log("afterStart", this.discoveryTopic)

		if (this.discoveryTopic !== null) {
			this.pubsub.subscribe(this.discoveryTopic)

			this.pubsub.addEventListener("message", async ({ detail: message }) => {
				if (message.topic !== this.discoveryTopic) {
					return
				}

				const payload = cbor.decode<{ topics: string[]; peerRecordEnvelope: Uint8Array }>(message.data)
				assert(typeof payload === "object", 'typeof payload === "object"')

				const { topics, peerRecordEnvelope } = payload
				assert(Array.isArray(topics), "expected Array.isArray(topics)")
				assert(peerRecordEnvelope instanceof Uint8Array, "expected peerRecordEnvelope instanceof Uint8Array")

				const topicIntersection = this.pubsub.getTopics().filter((topic) => topics.includes(topic))
				if (topicIntersection.length === 0) {
					return
				}

				const { peerId, multiaddrs } = await this.openPeerRecord(peerRecordEnvelope)
				this.log("received heartbeat from %s with topics %o", peerId, topics)

				await this.components.peerStore.consumePeerRecord(peerRecordEnvelope, peerId)
				this.dispatchEvent(new CustomEvent("peer", { detail: { id: peerId, multiaddrs, protocols: [] } }))

				for (const topic of topicIntersection) {
					const meshPeers = this.pubsub.getMeshPeers(topic)
					if (meshPeers.length >= this.minPeersPerTopic) {
						continue
					}

					await this.connect(peerId, multiaddrs)
				}
			})

			this.#heartbeat = setInterval(() => this.publishHeartbeat(), this.discoveryInterval)
			setTimeout(() => this.publishHeartbeat(), 3 * 1000)
		}
	}

	private async publishHeartbeat() {
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

	private handleFetch = async (key: string): Promise<Uint8Array | null> => {
		if (!key.startsWith(DiscoveryService.FETCH_KEY_PREFIX)) {
			return null
		}

		const topic = key.slice(DiscoveryService.FETCH_KEY_PREFIX.length)
		const results: Uint8Array[] = []
		for (const peerId of this.pubsub.getSubscribers(topic)) {
			const { peerRecordEnvelope } = await this.components.peerStore.get(peerId)
			if (peerRecordEnvelope !== undefined) {
				results.push(peerRecordEnvelope)
			}
		}

		return cbor.encode(results)
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

						const { peerId, multiaddrs } = await this.openPeerRecord(peerRecordEnvelope)
						if (peerId.equals(this.components.peerId)) {
							return
						} else if (meshPeers.includes(peerId.toString())) {
							return
						}

						this.dispatchEvent(new CustomEvent("peer", { detail: { id: peerId, multiaddrs, protocols: [] } }))
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
			this.log("already have connection to peer %p", peerId)
			return Promise.resolve()
		}

		const addrs = multiaddrs.flatMap((ma) => {
			const addr = ma.decapsulateCode(421)
			if (WebRTC.matches(addr) || WebSockets.matches(addr) || WebSocketsSecure.matches(addr)) {
				return addr.encapsulate(`/p2p/${peerId}`)
			} else {
				return []
			}
		})

		this.log("dialing %O", addrs)
		return this.components.connectionManager.openConnection(addrs, { priority: this.autoDialPriority }).then(
			() => this.log("connection opened successfully"),
			(err) => this.log.error("failed to open new connection to %p: %O", peerId, err),
		)
	}
}

export function discovery(
	init: DiscoveryServiceInit = {},
): (components: DiscoveryServiceComponents) => DiscoveryService {
	return (components) => new DiscoveryService(components, init)
}
