import type { PeerStore } from "@libp2p/interface/peer-store"
import type { Connection } from "@libp2p/interface/connection"
import type { Startable } from "@libp2p/interface/startable"
import type { PeerId } from "@libp2p/interface/peer-id"
import type { Registrar } from "@libp2p/interface-internal/registrar"
import type { ConnectionManager } from "@libp2p/interface-internal/connection-manager"
import { CustomEvent, EventEmitter } from "@libp2p/interface/events"
import { PeerDiscovery, PeerDiscoveryEvents, peerDiscovery } from "@libp2p/interface/peer-discovery"

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

	pubsub?: GossipSub
	fetch?: FetchService
}

export interface DiscoveryServiceInit {
	filterTopics?: (topic: string) => boolean
	minPeersPerTopic?: number
	autoDialPriority?: number
}

export class DiscoveryService extends EventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, Startable {
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
		return components.fetch
	}

	private readonly pubsub: GossipSub
	private readonly fetch: FetchService
	private readonly log = logger("canvas:discovery")
	private readonly minPeersPerTopic: number
	private readonly autoDialPriority: number
	private readonly filterTopics: (topic: string) => boolean

	private readonly topologyPeers = new Set<string>()

	#registrarId: string | null = null
	#queue = new PQueue({ concurrency: 1 })

	constructor(public readonly components: DiscoveryServiceComponents, private readonly init: DiscoveryServiceInit) {
		super()
		this.pubsub = DiscoveryService.extractGossipSub(components)
		this.fetch = DiscoveryService.extractFetchService(components)

		this.minPeersPerTopic = init.minPeersPerTopic ?? DiscoveryService.MIN_PEERS_PER_TOPIC
		this.autoDialPriority = init.autoDialPriority ?? DiscoveryService.AUTO_DIAL_PRIORITY
		this.filterTopics = init.filterTopics ?? ((topic) => true)
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
		this.fetch.registerLookupFunction("discover/", async (key) => {
			const [_, topic] = key.split("/")
			const records: Uint8Array[] = []
			for (const peerId of this.pubsub.getSubscribers(topic)) {
				try {
					const { peerRecordEnvelope } = await this.components.peerStore.get(peerId)
					if (peerRecordEnvelope !== undefined) {
						records.push(peerRecordEnvelope)
					}
				} catch (err) {
					this.log.error("failed to get peer info from peer store: %O", err)
				}
			}

			if (records.length === 0) {
				return null
			} else {
				return cbor.encode(records)
			}
		})

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

	public async beforeStop(): Promise<void> {
		this.#queue.clear()
		await this.#queue.onIdle()
	}

	public async stop(): Promise<void> {
		this.fetch.unregisterLookupFunction("discovery/")

		if (this.#registrarId !== null) {
			this.components.registrar.unregister(this.#registrarId)
			this.#registrarId = null
		}
	}

	private handleConnect(connection: Connection) {
		this.log("new connection to peer %p", connection.remotePeer)

		this.#queue
			.add(async () => {
				for (const topic of this.pubsub.getTopics().filter(this.filterTopics)) {
					const meshPeers = this.pubsub.getMeshPeers(topic)
					if (meshPeers.length >= this.minPeersPerTopic) {
						continue
					}

					this.log("want more peers for topic %s", topic)

					const key = `discover/${topic}`
					this.log("fetching %p %s", connection.remotePeer, key)
					const result = await this.fetch.fetch(connection.remotePeer, key)
					if (result === null) {
						this.log("got null result")
						continue
					}

					const records = cbor.decode<Uint8Array[]>(result)
					assert(Array.isArray(records))

					this.log("got %d results", records.length)

					for (const record of records) {
						assert(record instanceof Uint8Array)
						const envelope = await RecordEnvelope.openAndCertify(record, PeerRecord.DOMAIN)
						const { peerId, multiaddrs } = PeerRecord.createFromProtobuf(envelope.payload)
						assert(envelope.peerId.equals(peerId))

						if (peerId.equals(this.components.peerId)) {
							return
						} else if (meshPeers.includes(peerId.toString())) {
							return
						}

						this.dispatchEvent(
							new CustomEvent("peer", { detail: { id: peerId, multiaddrs: multiaddrs, protocols: [] } })
						)

						this.log("adding %p to peer store with multiaddrs %o", peerId, multiaddrs)
						await this.components.peerStore.merge(peerId, {
							addresses: multiaddrs.map((multiaddr) => ({ isCertified: true, multiaddr })),
						})

						await this.connect(peerId)
					}
				}
			})
			.catch((err) => this.log.error("error handling new connection: %O", err))
	}

	private async connect(peerId: PeerId) {
		const existingConnections = this.components.connectionManager.getConnections(peerId)

		if (existingConnections.length > 0) {
			this.log("already have connection to peer %p", peerId)
			return
		}

		this.log("connecting to peer %p", peerId)
		try {
			await this.components.connectionManager.openConnection(peerId, { priority: this.autoDialPriority })
			this.log("connection opened successfully")
		} catch (err) {
			this.log.error("failed to open new connection to %p: %O", peerId, err)
		}
	}
}

export function discovery(
	init: DiscoveryServiceInit = {}
): (components: DiscoveryServiceComponents) => DiscoveryService {
	return (components) => new DiscoveryService(components, init)
}
