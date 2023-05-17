import { Startable } from "@libp2p/interfaces/startable"
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"
import { PeerDiscovery, PeerDiscoveryEvents, peerDiscovery } from "@libp2p/interface-peer-discovery"
import { AddressManager } from "@libp2p/interface-address-manager"
import { ConnectionManager } from "@libp2p/interface-connection-manager"
import { Registrar, StreamHandler, Topology } from "@libp2p/interface-registrar"
import { Message, SignedMessage } from "@libp2p/interface-pubsub"
import { Connection, Stream } from "@libp2p/interface-connection"
import { PeerId } from "@libp2p/interface-peer-id"
import { PeerInfo } from "@libp2p/interface-peer-info"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { createTopology } from "@libp2p/topology"
import { logger } from "@libp2p/logger"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { pipe } from "it-pipe"
import { pushable, Pushable } from "it-pushable"
import * as lp from "it-length-prefixed"

import Discovery from "#protocols/discovery"

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
	toSignedMessage,
} from "./utils.js"

export interface ServiceDiscoveryComponents {
	peerId: PeerId
	registrar: Registrar
	addressManager: AddressManager
	connectionManager: ConnectionManager
}

export interface ServiceDiscoveryInit {
	cache?: ServiceRecordCache
	topic?: string
	protocol?: string
	interval?: number
	delay?: number

	filterProtocols?: (protocol: string) => boolean

	maxInboundStreams?: number
	maxOutboundStreams?: number
	newConnectionTimeout?: number
	newStreamTimeout?: number
	autoDialPriority?: number
}

export interface ServiceDiscovery {}

export class PubsubServiceDiscovery
	extends EventEmitter<PeerDiscoveryEvents>
	implements ServiceDiscovery, PeerDiscovery, Startable
{
	public static DISCOVERY_PROTOCOL = "/canvas/v0/discovery/query"
	public static DISCOVERY_TOPIC = "/canvas/v0/discovery"
	public static DISCOVERY_INTERVAL = 5 * minute
	public static DISCOVERY_DELAY = 10 * second

	public static MIN_CONNECTIONS_PER_PROTOCOL = 5
	public static NEW_CONNECTION_TIMEOUT = 20 * second
	public static NEW_STREAM_TIMEOUT = 10 * second
	public static AUTO_DIAL_PRIORITY = 1

	private static extractGossipSub(components: ServiceDiscoveryComponents): GossipSub {
		const { pubsub } = components as ServiceDiscoveryComponents & { pubsub?: GossipSub }
		if (pubsub === undefined) {
			throw new Error("missing pubsub service")
		} else {
			return pubsub
		}

		// if (pubsub instanceof GossipSub) {
		// 	return pubsub
		// } else if (pubsub !== undefined) {
		// 	throw new Error("pubsub service is not a GossipSub instance")
		// } else {
		// 	throw new Error("missing pubsub service")
		// }
	}

	private readonly log = logger("canvas:pubsub-service-discovery")
	private readonly pubsub: GossipSub
	private readonly cache: ServiceRecordCache
	private readonly topic: string
	private readonly protocol: string
	private readonly topology: Topology

	private timer: NodeJS.Timer | null = null
	private registrarId: string | null = null

	constructor(public readonly components: ServiceDiscoveryComponents, private readonly init: ServiceDiscoveryInit) {
		super()
		this.pubsub = PubsubServiceDiscovery.extractGossipSub(components)
		this.cache = init.cache ?? new MemoryCache()
		this.topic = init.topic ?? PubsubServiceDiscovery.DISCOVERY_TOPIC
		this.protocol = init.protocol ?? PubsubServiceDiscovery.DISCOVERY_PROTOCOL
		this.topology = createTopology({
			onConnect: (peerId, connection) => {
				this.topology.peers.add(peerId.toString())
				this.handleConnect(connection)
			},
			onDisconnect: (peerId) => {
				this.topology.peers.delete(peerId.toString())
			},
		})
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
		this.pubsub.addEventListener("message", this.handleMessage)

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

		this.timer = globalThis.setInterval(() => {
			this.publish()
		}, this.init.interval ?? PubsubServiceDiscovery.DISCOVERY_INTERVAL)

		setTimeout(() => {
			this.publish()
		}, this.init.delay ?? PubsubServiceDiscovery.DISCOVERY_DELAY)
	}

	public beforeStop(): void {
		if (this.timer !== null) {
			clearInterval(this.timer)
		}

		this.cache.close()
	}

	public stop(): void {
		if (this.registrarId !== null) {
			this.components.registrar.unregister(this.registrarId)
		}
	}

	private async publish() {
		this.log("publishing discovery record")

		const addrs = this.components.addressManager.getAddresses()
		const protocols = this.getProtocols()

		const record = Discovery.Record.encode({
			addrs: addrs.map((addr) => addr.bytes),
			protocols: protocols.filter(this.init.filterProtocols ?? all),
		}).finish()

		try {
			const { recipients } = await this.pubsub.publish(this.topic, record, {
				allowPublishToZeroPeers: true,
				ignoreDuplicatePublishError: true,
			})

			this.log("published discovery record to %d peers", recipients.length)
		} catch (err) {
			this.log.error("failed to publish discovery record: %O", err)
		}
	}

	private handleMessage = ({ detail: msg }: CustomEvent<Message>) => {
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

			this.cache.insert(record.protocols, msg)

			const peerInfo: PeerInfo = { id: msg.from, multiaddrs: addrs, protocols: record.protocols }
			this.dispatchEvent(new CustomEvent("peer", { detail: peerInfo }))

			const requests = this.getRequests()
			if (record.protocols.some((protocol) => requests.has(protocol))) {
				this.connect(msg.from, addrs)
			}
		}
	}

	private async connect(peerId: PeerId, addrs: Multiaddr[]) {
		const existingConnections = this.components.connectionManager.getConnections(peerId)
		if (existingConnections.length > 0) {
			this.log("already have %d connections to peer %p", existingConnections.length, peerId)
			return
		}

		try {
			this.log("connecting to peer %p", peerId)

			await this.components.connectionManager.openConnection(addrs, {
				// @ts-expect-error needs adding to the ConnectionManager interface
				priority: this.init.autoDialPriority ?? PubsubServiceDiscovery.AUTO_DIAL_PRIORITY,
			})

			this.log("connection opened successfully")
		} catch (err) {
			this.log.error("failed to open new connection to peer %p: %O", peerId, err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection: { remotePeer: peer }, stream }) => {
		this.log("opened incoming stream %s from peer %p", stream.id, peer)

		const cache = this.cache
		async function* handle(reqs: AsyncIterable<Discovery.QueryRequest>) {
			for await (const { protocol, limit } of reqs) {
				const records = cache.query(protocol, limit)
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
		this.log("new connection peer %p", connection.remotePeer)

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
			const requestSource: Pushable<Discovery.IQueryRequest> = pushable({ objectMode: true })
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

		this.log("got %d responses from peer %p", responses.size, connection.remotePeer)

		for (const { msg, record } of responses.values()) {
			if (msg.from.equals(this.components.peerId)) {
				continue
			}

			this.cache.insert(record.protocols, msg)

			const addrs = record.addrs.map(multiaddr)

			// TODO: think about whether we should actually emit `peer` events or not...
			const peerInfo: PeerInfo = { id: msg.from, multiaddrs: addrs, protocols: record.protocols }
			this.dispatchEvent(new CustomEvent("peer", { detail: peerInfo }))

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
		const requests = new Map<string, { limit: number }>()

		const { registrar } = this.components
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

export function pubsubServiceDiscovery(
	init: ServiceDiscoveryInit = {}
): (components: ServiceDiscoveryComponents) => ServiceDiscovery {
	return (components) => new PubsubServiceDiscovery(components, init)
}
