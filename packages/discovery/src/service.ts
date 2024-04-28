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

import type { SignerCache } from "@canvas-js/interfaces"

import { assert, second } from "./utils.js"

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
	evictionInterval?: number
	evictionThreshold?: number
	responseHeartbeatThreshold?: number

	minPeersPerTopic?: number
	autoDialPriority?: number

	signers?: SignerCache
	appTopic?: string

	trackAllPeers?: boolean
	isUniversalReplication?: boolean
}

export type PeerEnv = "browser" | "server"
export type PresenceStore = Record<
	string,
	{ peerId: PeerId; lastSeen: number | null; env: PeerEnv; address: string | null; topics: string[] }
>

export const defaultHeartbeatInterval = 60 * 1000 // publish heartbeat once every minute

export const defaultEvictionInterval = 5 * 1000 // run a timer to evict peers from the presence cache every 5s
export const defaultEvictionThreshold = 90 * 1000 // only if they haven't been seen in 1m 30s

export const defaultResponseHeartbeatThreshold = 15 * 1000 // send response heartbeat upon new peers joining the mesh, up to once every 60 seconds

export interface DiscoveryServiceEvents extends PeerDiscoveryEvents {
	"peer:topics": CustomEvent<{
		peerId: PeerId
		env: PeerEnv
		address: string | null
		topics: string[]
		isUniversalReplication?: boolean
	}>
	"presence:join": CustomEvent<{
		peerId: PeerId
		env: PeerEnv
		address: string | null
		topics: string[]
		peers: PresenceStore
	}>
	"presence:leave": CustomEvent<{ peerId: PeerId; peers: PresenceStore }>
}

export class DiscoveryService extends TypedEventEmitter<DiscoveryServiceEvents> implements PeerDiscovery, Startable {
	public static FETCH_KEY_PREFIX = "discovery/"
	public static FETCH_ALL_KEY_PREFIX = "discovery-all/"

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
	private readonly evictionThreshold: number
	private readonly evictionInterval: number
	private readonly responseHeartbeatThreshold: number
	private readonly topologyPeers = new Set<string>() // peers we are directly connected to
	private readonly discoveryPeers: PresenceStore = {} // peers on the same discovery topic (may be on different app topics)

	private lastResponseHeartbeat: number = new Date().getTime()

	private readonly signers: SignerCache | null
	private readonly appTopic: string | null
	private readonly trackAllPeers: boolean // fetch and emit presence events for all peers on the discovery topic
	private readonly isUniversalReplication: boolean

	readonly #discoveryQueue = new PQueue({ concurrency: 1 })
	readonly #dialQueue = new PQueue({ concurrency: 5 })

	#registrarId: string | null = null
	#heartbeatTimer: NodeJS.Timeout | null = null
	#evictionTimer: NodeJS.Timeout | null = null

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
		this.discoveryInterval = init.discoveryInterval ?? defaultHeartbeatInterval
		this.evictionInterval = init.evictionInterval ?? defaultEvictionInterval
		this.evictionThreshold = init.evictionThreshold ?? defaultEvictionThreshold
		this.responseHeartbeatThreshold = init.responseHeartbeatThreshold ?? defaultResponseHeartbeatThreshold
		this.addressFilter = init.addressFilter ?? ((addr) => true)
		this.signers = init.signers ?? null
		this.appTopic = init.appTopic ?? null
		this.trackAllPeers = init.trackAllPeers ?? false
		this.isUniversalReplication = init.isUniversalReplication ?? false
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
		this.fetch.registerLookupFunction(DiscoveryService.FETCH_ALL_KEY_PREFIX, this.handleFetch)
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
				delete this.discoveryPeers[peerId.toString()]
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

				const payload = cbor.decode<{
					topics: string[]
					address: string | null
					env: "browser" | "server"
					peerRecordEnvelope: Uint8Array
					isUniversalReplication?: boolean
				}>(message.data)
				assert(typeof payload === "object", 'typeof payload === "object"')

				if (payload instanceof Uint8Array) return // ignore legacy discovery payloads

				const { topics, isUniversalReplication, address, env, peerRecordEnvelope } = payload

				assert(Array.isArray(topics), "expected Array.isArray(topics)")
				assert(peerRecordEnvelope instanceof Uint8Array, "expected peerRecordEnvelope instanceof Uint8Array")
				const { peerId, multiaddrs } = await this.openPeerRecord(peerRecordEnvelope)

				// emit an active discovery event for peers on other topics
				this.log("received heartbeat from %s with topics %o", peerId, topics)
				this.dispatchEvent(
					new CustomEvent("peer:topics", {
						detail: { peerId, address, env, topics, isUniversalReplication: isUniversalReplication ?? false },
					}),
				)
				this.handlePeerEvent(peerId, multiaddrs, env, address, topics, "active")

				const topicIntersection = this.pubsub.getTopics().filter((topic) => topics.includes(topic))
				if (topicIntersection.length === 0) {
					return
				}

				// found a peer via active discovery
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

			// publish the heartbeat at these times:
			// 1) after the first connection to a peer
			// 2) at the heartbeat interval
			// 3) after new peers joining this specific topic
			this.#heartbeatTimer = setInterval(() => this.publishHeartbeat(), this.discoveryInterval)
			this.components.events.addEventListener(
				"connection:open",
				({ detail: connection }) => {
					setTimeout(() => {
						this.publishHeartbeat()
						this.lastResponseHeartbeat = 0
						// reset response heartbeat, so we send it again on the next incoming connection
						// this helps ensure we get an actual `lastSeen` value for very small meshes
					}, 1000)
				},
				{ once: true },
			)
			this.addEventListener("presence:join", ({ detail: { peerId } }) => {
				if (this.lastResponseHeartbeat > new Date().getTime() - this.responseHeartbeatThreshold) return
				this.lastResponseHeartbeat = new Date().getTime()
				this.publishHeartbeat()
			})

			// we preload recently seen peers using passive discovery, but if those peers haven't
			// sent a heartbeat within ~one heartbeat interval, flush them from the cache
			setTimeout(() => {
				Object.entries(this.discoveryPeers).forEach(([peerId, { lastSeen }]) => {
					if (lastSeen === null) {
						delete this.discoveryPeers[peerId.toString()]
						this.dispatchEvent(new CustomEvent("presence:leave", { detail: { peerId, peers: this.discoveryPeers } }))
					}
				})
			}, this.discoveryInterval + this.evictionInterval)

			// evict peers when they've been offline
			this.#evictionTimer = setInterval(() => {
				Object.entries(this.discoveryPeers).forEach(([peerId, { lastSeen }]) => {
					if (lastSeen !== null && lastSeen < new Date().getTime() - this.evictionThreshold) {
						delete this.discoveryPeers[peerId.toString()]
						this.dispatchEvent(new CustomEvent("presence:leave", { detail: { peerId, peers: this.discoveryPeers } }))
					}
				})
			}, this.evictionInterval)
		}
	}

	private async publishHeartbeat() {
		this.log("publishing heartbeat")
		if (this.discoveryTopic === null || this.#heartbeatTimer === null) {
			return
		}

		const topics = this.pubsub.getTopics().filter((topic) => this.topicFilter(topic))
		const topicsLastActive: Record<string, number> = Object.fromEntries(topics.map((topic: string) => [topic, 0]))

		const multiaddrs = this.components.addressManager
			.getAddresses()
			.filter((addr) => !isLoopback(addr) && !isPrivate(addr))

		if (multiaddrs.length === 0) {
			this.log.error("no multiaddrs to publish")
		}

		// include the logged-in address, if we have one
		let address = null
		if (this.appTopic !== null && this.signers !== null) {
			let session
			for (const signer of this.signers.getAll()) {
				try {
					const timestamp = Date.now()
					const session = await signer.getSession(this.appTopic, { timestamp, fromCache: true })
					address = session.address
				} catch (err) {
					continue // no session
				}
			}
		}

		const peerRecord = new PeerRecord({ multiaddrs, peerId: this.components.peerId })
		const envelope = await RecordEnvelope.seal(peerRecord, this.components.peerId)

		const env = typeof window === "object" ? "browser" : "server"

		const payload = { topics, topicsLastActive, address, env, peerRecordEnvelope: envelope.marshal() }
		this.pubsub.publish(this.discoveryTopic, cbor.encode(payload)).then(
			({ recipients }) => this.log("published heartbeat to %d recipients", recipients.length),
			(err) => this.log.error("failed to publish heartbeat: %o", err),
		)
	}

	public async beforeStop(): Promise<void> {
		if (this.#heartbeatTimer !== null) {
			clearInterval(this.#heartbeatTimer)
			this.#heartbeatTimer = null
		}
		if (this.#evictionTimer !== null) {
			clearInterval(this.#evictionTimer)
			this.#evictionTimer = null
		}

		this.fetch.unregisterLookupFunction(DiscoveryService.FETCH_KEY_PREFIX, this.handleFetch)
		this.fetch.unregisterLookupFunction(DiscoveryService.FETCH_ALL_KEY_PREFIX, this.handleFetch)
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
		if (!key.startsWith(DiscoveryService.FETCH_KEY_PREFIX) && !key.startsWith(DiscoveryService.FETCH_ALL_KEY_PREFIX)) {
			return undefined
		}

		const topic = key.startsWith(DiscoveryService.FETCH_KEY_PREFIX)
			? key.slice(DiscoveryService.FETCH_KEY_PREFIX.length)
			: key.slice(DiscoveryService.FETCH_ALL_KEY_PREFIX.length)
		const fetchAll = key.startsWith(DiscoveryService.FETCH_ALL_KEY_PREFIX)

		if (fetchAll) {
			this.log("handling fetch request for all peers")
		} else {
			this.log("handling fetch request for peers on topic %s", topic)
		}

		// for fetch_all, return the union of peers in the discovery cache, and the currently subscribed peers
		const peers = this.pubsub.getSubscribers(topic)
		if (fetchAll) {
			const peerIds = peers.map((p) => p.toString())
			for (const peerId of Object.values(this.discoveryPeers).map((p) => p.peerId)) {
				if (!peerIds.includes(peerId.toString())) {
					peers.push(peerId)
				}
			}
		}

		const results = new Map<
			PeerId,
			{
				topics: string[]
				address: string | null
				env: PeerEnv
				peerRecordEnvelope: Uint8Array
			}
		>()
		for (const peerId of peers) {
			const { peerRecordEnvelope } = await this.components.peerStore.get(peerId)
			if (peerRecordEnvelope !== undefined) {
				results.set(peerId, {
					topics: this.discoveryPeers[peerId.toString()].topics ?? [],
					address: this.discoveryPeers[peerId.toString()].address ?? null,
					env: this.discoveryPeers[peerId.toString()].env ?? null,
					peerRecordEnvelope,
				})
			}
		}

		if (fetchAll) {
			this.log("found %d known peers for all topics: %o", results.size, [...results.keys()])
		} else {
			this.log("found %d subscribers for topic %s: %o", results.size, topic, [...results.keys()])
		}
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
					const key =
						(this.trackAllPeers ? DiscoveryService.FETCH_ALL_KEY_PREFIX : DiscoveryService.FETCH_KEY_PREFIX) + topic
					this.log("fetching new peers from %p", key, connection.remotePeer)
					// sometimes fetch will throw an error when asking for FETCH_ALL_KEY_PREFIX
					const result = await this.fetch.fetch(connection.remotePeer, key).catch((err) => undefined)
					if (result === undefined) {
						this.log("no response from %p", connection.remotePeer)
						continue
					}

					type Peer = {
						topics: string[]
						topicsLastActive?: Record<string, number>
						address: string | null
						env: PeerEnv
						peerRecordEnvelope: Uint8Array
					}
					const peers = cbor.decode<Peer[]>(result)
					assert(Array.isArray(peers), "expected Array.isArray(peers)")

					this.log("got %d peers via fetch from %p", peers.length, connection.remotePeer)

					if (peers[0] instanceof Uint8Array) return // ignore legacy fetch payloads

					for (const { topics, address, env, peerRecordEnvelope } of peers) {
						assert(Array.isArray(topics), "expected Array.isArray(topics)")
						assert(peerRecordEnvelope instanceof Uint8Array, "expected record instanceof Uint8Array")

						const { peerId, multiaddrs } = await this.openPeerRecord(peerRecordEnvelope)
						if (peerId.equals(this.components.peerId)) {
							return
						} else if (meshPeers.includes(peerId.toString())) {
							return
						}

						// found a peer via passive discovery
						this.dispatchEvent(new CustomEvent("peer", { detail: { id: peerId, multiaddrs, protocols: [] } }))
						this.handlePeerEvent(peerId, multiaddrs, env, address, topics, "passive")
						await this.components.peerStore.consumePeerRecord(peerRecordEnvelope, peerId)
						this.#dialQueue.add(() => this.connect(peerId, multiaddrs))
					}
				}
			})
			.catch((err) => {
				this.log.error("error handling new connection to %p: %O", connection.remoteAddr.toString(), err)
			})
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

	private async handlePeerEvent(
		peerId: PeerId,
		multiaddrs: Multiaddr[],
		env: "browser" | "server",
		address: string | null = null,
		topics: string[] = [],
		discoveryType: "active" | "passive",
	) {
		const existed = this.discoveryPeers[peerId.toString()] !== undefined

		// update lastSeen, unless we're preloading a peer from passive discovery
		let lastSeen = null
		if (discoveryType === "passive" && this.discoveryPeers[peerId.toString()]) {
			lastSeen = this.discoveryPeers[peerId.toString()].lastSeen
		} else if (discoveryType === "active") {
			lastSeen = new Date().getTime()
		}

		// update the peerinfo object in-place because clients may have stored a reference to it
		if (this.discoveryPeers[peerId.toString()]) {
			this.discoveryPeers[peerId.toString()].lastSeen = lastSeen
			this.discoveryPeers[peerId.toString()].env = env
			this.discoveryPeers[peerId.toString()].address = address
			this.discoveryPeers[peerId.toString()].topics = topics
		} else {
			this.discoveryPeers[peerId.toString()] = {
				peerId,
				lastSeen,
				env,
				address,
				topics,
			}
		}

		// dispatch presence:join if we're tracking all topics, or this peer is on our app topic
		const topicIntersection = this.pubsub.getTopics().filter((topic) => topics.includes(topic))
		const shouldEmitPresence = topicIntersection.length > 0 || this.trackAllPeers
		if (!existed && shouldEmitPresence) {
			this.dispatchEvent(
				new CustomEvent("presence:join", {
					detail: { peerId, env, address, topics, peers: this.discoveryPeers },
				}),
			)
		}
	}
}

export function discovery(
	init: DiscoveryServiceInit = {},
): (components: DiscoveryServiceComponents) => DiscoveryService {
	return (components) => new DiscoveryService(components, init)
}
