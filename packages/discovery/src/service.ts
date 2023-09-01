import type { Libp2pEvents, PeerUpdate } from "@libp2p/interface"
import type { Startable } from "@libp2p/interface/startable"
import type { AddressManager } from "@libp2p/interface-internal/address-manager"
import type { ConnectionManager } from "@libp2p/interface-internal/connection-manager"
import type { PeerStore } from "@libp2p/interface/peer-store"
import type { Registrar, StreamHandler } from "@libp2p/interface-internal/registrar"
import type { Message, SignedMessage, SubscriptionChangeData } from "@libp2p/interface/pubsub"
import type { Connection, Stream } from "@libp2p/interface/connection"
import type { PeerId } from "@libp2p/interface/peer-id"
import type { PeerInfo } from "@libp2p/interface/peer-info"

import { PeerDiscovery, PeerDiscoveryEvents, peerDiscovery } from "@libp2p/interface/peer-discovery"
import { CustomEvent, EventEmitter } from "@libp2p/interface/events"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { logger } from "@libp2p/logger"

import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"
import * as lp from "it-length-prefixed"

import * as Discovery from "./protocols/discovery.js"

import { ServiceRecordCache, MemoryCache } from "./cache.js"
import {
	all,
	decodeRequests,
	decodeResponses,
	encodeRequests,
	encodeResponses,
	fromSignedMessage,
	minute,
	second,
	shuffle,
	toSignedMessage,
} from "./utils.js"

interface Topology {
	min?: number
	max?: number

	onConnect?: (peerId: PeerId, conn: Connection) => void
	onDisconnect?: (peerId: PeerId) => void
}

export interface DiscoveryServiceComponents {
	peerId: PeerId
	events: EventEmitter<Libp2pEvents>
	peerStore: PeerStore
	registrar: Registrar
	addressManager: AddressManager
	connectionManager: ConnectionManager
	pubsub?: GossipSub
}

export interface DiscoveryServiceInit {
	cache?: ServiceRecordCache
	topic?: string
	protocol?: string
	interval?: number
	delay?: number

	filterProtocols?: (protocol: string) => boolean
	filterMultiaddrs?: (multiaddr: Multiaddr) => boolean

	maxInboundStreams?: number
	maxOutboundStreams?: number
	newConnectionTimeout?: number
	newStreamTimeout?: number
	autoDialPriority?: number
}

export class DiscoveryService extends EventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, Startable {
	public static DISCOVERY_PROTOCOL = "/canvas/v0/discovery/query"
	public static DISCOVERY_TOPIC = "/canvas/v0/discovery"
	public static DISCOVERY_INTERVAL = 5 * minute
	public static DISCOVERY_DELAY = 10 * second

	public static MIN_CONNECTIONS_PER_PROTOCOL = 5
	public static NEW_CONNECTION_TIMEOUT = 20 * second
	public static NEW_STREAM_TIMEOUT = 10 * second
	public static AUTO_DIAL_PRIORITY = 1

	private static extractGossipSub({ pubsub }: DiscoveryServiceComponents): GossipSub {
		if (pubsub instanceof GossipSub) {
			return pubsub
		} else if (pubsub !== undefined) {
			throw new Error("pubsub service is not a GossipSub instance")
		} else {
			throw new Error("missing pubsub service")
		}
	}

	private readonly log = logger("canvas:discovery")
	private readonly pubsub: GossipSub
	private readonly cache: ServiceRecordCache
	private readonly topic: string
	private readonly protocol: string
	private readonly topology: Topology
	private readonly topologyPeers = new Set<string>()

	private lastPublishedRecipientCount = 0
	private timer: NodeJS.Timer | null = null
	private registrarId: string | null = null

	constructor(public readonly components: DiscoveryServiceComponents, private readonly init: DiscoveryServiceInit) {
		super()
		this.pubsub = DiscoveryService.extractGossipSub(components)
		this.cache = init.cache ?? new MemoryCache()
		this.topic = init.topic ?? DiscoveryService.DISCOVERY_TOPIC
		this.protocol = init.protocol ?? DiscoveryService.DISCOVERY_PROTOCOL

		this.topology = {
			onConnect: (peerId, connection) => {
				this.topologyPeers.add(peerId.toString())
				this.handleConnect(connection)
			},
			onDisconnect: (peerId) => {
				this.topologyPeers.delete(peerId.toString())
			},
		}
	}

	get [peerDiscovery](): PeerDiscovery {
		return this
	}

	get [Symbol.toStringTag](): "@canvas-js/pubsub-service-discovery" {
		return "@canvas-js/pubsub-service-discovery"
	}

	public isStarted(): boolean {
		return this.timer === null
	}

	public start() {
		this.components.events.addEventListener("self:peer:update", this.handleSelfPeerUpdate)

		this.pubsub.addEventListener("message", this.handleMessage)
		this.pubsub.addEventListener("subscription-change", this.handleSubscriptionChange)

		this.components.registrar.handle(this.protocol, this.handleIncomingStream, {
			maxInboundStreams: this.init.maxInboundStreams,
			maxOutboundStreams: this.init.maxOutboundStreams,
		})

		this.components.registrar.register(this.protocol, this.topology).then((registrarId) => {
			this.registrarId = registrarId
		})
	}

	public afterStart() {
		this.pubsub.subscribe(this.topic)
		this.timer = setInterval(() => this.publish(), this.init.interval ?? DiscoveryService.DISCOVERY_INTERVAL)
	}

	public beforeStop(): void {
		this.pubsub.unsubscribe(this.topic)

		if (this.timer !== null) {
			// @ts-expect-error fdkalf
			clearInterval(this.timer)
		}

		this.cache.stop()
	}

	public stop(): void {
		this.components.events.removeEventListener("self:peer:update", this.handleSelfPeerUpdate)

		this.pubsub.removeEventListener("message", this.handleMessage)
		this.pubsub.removeEventListener("subscription-change", this.handleSubscriptionChange)

		this.components.registrar.unhandle(this.protocol)

		if (this.registrarId !== null) {
			this.components.registrar.unregister(this.registrarId)
		}
	}

	public query(protocol: string, options: { limit?: number } = {}): PeerInfo[] {
		return this.cache.query(protocol, options).map((msg) => {
			const record = Discovery.Record.decode(msg.data)
			return {
				id: msg.from,
				multiaddrs: record.addrs.map(multiaddr),
				protocols: record.protocols,
			}
		})
	}

	private publish() {
		const addrs = this.components.addressManager.getAddresses()
		const protocols = this.getProtocols()

		if (addrs.length === 0) {
			this.log("no addresses to publish")
			return
		}

		this.log("publishing discovery record for protocols %o", protocols)

		const record = Discovery.Record.encode({
			addrs: addrs.map((addr) => addr.bytes),
			protocols: protocols.filter(this.init.filterProtocols ?? all),
		})

		this.pubsub
			.publish(this.topic, record, {
				allowPublishToZeroPeers: true,
				ignoreDuplicatePublishError: true,
			})
			.then(({ recipients }) => {
				this.log("published discovery record to %d peers", recipients.length)
				this.lastPublishedRecipientCount = recipients.length
			})
			.catch((err) => {
				this.log.error("failed to publish discovery record: %O", err)
				this.lastPublishedRecipientCount = 0
			})
	}

	private handleSelfPeerUpdate = ({ detail: { peer, previous } }: CustomEvent<PeerUpdate>) => {
		if (previous !== undefined) {
			const newAddress = peer.addresses.find((newAddress) => {
				for (const oldAddress of previous.addresses) {
					if (newAddress.multiaddr.equals(oldAddress.multiaddr)) {
						return false
					}
				}

				return true
			})

			const oldAddress = previous.addresses.find((oldAddress) => {
				for (const newAddress of peer.addresses) {
					if (oldAddress.multiaddr.equals(newAddress.multiaddr)) {
						return false
					}
				}

				return true
			})

			if (newAddress !== undefined || oldAddress !== undefined) {
				this.log("self addresses changed")
				this.publish()
			}
		} else if (peer.addresses.length > 0) {
			this.log("self addresses changed")
			this.publish()
		}
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<Message>) => {
		if (msg.type === "signed" && msg.topic === this.topic) {
			if (msg.from.equals(this.components.peerId)) {
				return
			}

			let record: Discovery.Record | null = null
			try {
				record = Discovery.Record.decode(msg.data)
			} catch (err) {
				this.log.error("failed to decode discovery record: %O", err)
				return
			}

			this.log("received discovery record from peer %p for protocols %o", msg.from, record.protocols)

			// TODO: verify signature and that addrs end with `/p2p/${msg.from}`
			const addrs = record.addrs.map(multiaddr)
			shuffle(addrs)

			this.cache.insert(record.protocols, msg)

			const requests = this.getRequests()
			if (record.protocols.some((protocol) => requests.has(protocol))) {
				await this.setPeerInfo({
					id: msg.from,
					multiaddrs: addrs,
					protocols: record.protocols,
				})

				this.connect(msg.from, addrs)
			}
		}
	}

	private async setPeerInfo(peerInfo: PeerInfo) {
		try {
			await this.components.peerStore.merge(peerInfo.id, {
				multiaddrs: peerInfo.multiaddrs,
				addresses: peerInfo.multiaddrs.map((multiaddr) => ({ isCertified: true, multiaddr })),
				protocols: peerInfo.protocols,
			})

			this.log("updated peer store")
		} catch (err) {
			this.log.error("failed to update peer store: %O", err)
		}

		// TODO: is this redundant??
		this.dispatchEvent(new CustomEvent("peer", { detail: peerInfo }))
	}

	private handleSubscriptionChange = async ({
		detail: { peerId, subscriptions },
	}: CustomEvent<SubscriptionChangeData>) => {
		const subscription = subscriptions.find(({ topic }) => topic === this.topic)
		if (subscription !== undefined && subscription.subscribe) {
			this.log("added peer %p to the service discovery mesh", peerId)
			if (this.lastPublishedRecipientCount === 0) {
				this.publish()
			}
		}
	}

	private async connect(peerId: PeerId, addrs: Multiaddr[]) {
		const existingConnections = this.components.connectionManager.getConnections(peerId)

		if (existingConnections.length > 0) {
			this.log("already have connection to peer %p", peerId)
			return
		}

		this.log("connecting to peer %p", peerId)
		try {
			await this.components.connectionManager.openConnection(peerId, {
				priority: this.init.autoDialPriority ?? DiscoveryService.AUTO_DIAL_PRIORITY,
			})

			this.log("connection opened successfully")
		} catch (err) {
			this.log.error("failed to open new connection to %p: %O", peerId, err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection: { remotePeer: peer }, stream }) => {
		this.log("opened incoming stream %s from peer %p", stream.id, peer)

		const cache = this.cache
		async function* handle(reqs: AsyncIterable<Discovery.QueryRequest>) {
			for await (const { protocol, limit } of reqs) {
				const records = cache.query(protocol, { limit })
				yield { records: records.map(fromSignedMessage) }
			}
		}

		try {
			await pipe(stream, lp.decode, decodeRequests, handle, encodeResponses, lp.encode, stream)
			this.log("closed incoming stream %s from peer %p", stream.id, peer)
		} catch (err) {
			this.log.error("error handling incoming stream %s: %O", stream.id, err)
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error(`error handling incoming ${this.protocol} stream`))
			}
		}
	}

	private handleConnect = async (connection: Connection): Promise<void> => {
		this.log("new connection to peer %p", connection.remotePeer)

		const requests = this.getRequests()
		if (requests.size === 0) {
			return
		}

		this.log("have %d outstanding protocol requests", requests.size)

		let stream: Stream
		try {
			stream = await connection.newStream(this.protocol)
			this.log("opened outgoing stream %s to peer %p", stream.id, connection.remotePeer)
		} catch (err) {
			const { id, remotePeer } = connection
			this.log.error("failed to open stream on connection %s to peer %p: %O", id, remotePeer, err)
			return
		}

		const responses = new Map<string, { msg: SignedMessage; record: Discovery.Record }>()

		try {
			const responseSink = pipe(stream.source, lp.decode, decodeResponses)
			const requestSource: Pushable<Discovery.QueryRequest> = pushable({
				objectMode: true,
			})
			pipe(requestSource, encodeRequests, lp.encode, stream.sink).catch((err) => {
				if (err instanceof Error) {
					stream.abort(err)
				} else {
					stream.abort(new Error("internal error"))
				}
			})

			const iter = responseSink[Symbol.asyncIterator]()
			for (const [protocol, { limit }] of requests) {
				requestSource.push({ protocol, limit })
				const { done, value: res } = await iter.next()
				if (done) {
					throw new Error("response stream ended prematurely")
				}

				for (const msg of res.records.map(toSignedMessage)) {
					const id = msg.from.toString()
					const existingResponse = responses.get(id)
					if (existingResponse === undefined || existingResponse.msg.sequenceNumber < msg.sequenceNumber) {
						const record = Discovery.Record.decode(msg.data)
						responses.set(id, { msg, record })
					}
				}
			}

			requestSource.end()
		} catch (err) {
			this.log.error("failed to query peer %p: %O", connection.remotePeer, err)
		} finally {
			stream.close()
		}

		this.log("got %d responses from peer %p: %o", responses.size, connection.remotePeer, [...responses.keys()])

		for (const { msg, record } of responses.values()) {
			if (msg.from.equals(this.components.peerId)) {
				continue
			}

			this.cache.insert(record.protocols, msg)

			const addrs = record.addrs.map(multiaddr)
			await this.setPeerInfo({
				id: msg.from,
				multiaddrs: addrs,
				protocols: record.protocols,
			})

			this.connect(msg.from, addrs)
		}
	}

	private getProtocols(): string[] {
		const protocols: string[] = []
		for (const protocol of this.components.registrar.getProtocols()) {
			if (this.init.filterProtocols === undefined || this.init.filterProtocols(protocol)) {
				protocols.push(protocol)
			}
		}

		return protocols
	}

	private getRequests(): Map<string, { limit: number }> {
		const { registrar } = this.components

		const requests = new Map<string, { limit: number }>()

		for (const protocol of this.getProtocols()) {
			for (const topology of registrar.getTopologies(protocol)) {
				if (topology.peers.size < topology.min) {
					const target = Math.min(topology.min * 2, topology.max)
					const limit = target - topology.peers.size
					requests.set(protocol, { limit })
					break
				}
			}
		}

		return requests
	}
}

export function discovery(
	init: DiscoveryServiceInit = {}
): (components: DiscoveryServiceComponents) => DiscoveryService {
	return (components) => new DiscoveryService(components, init)
}
