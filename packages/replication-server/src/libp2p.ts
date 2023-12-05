import assert from "node:assert"

import { Libp2pOptions } from "libp2p"
import { PingService, pingService } from "libp2p/ping"
import { identifyService } from "libp2p/identify"
import { FetchService, fetchService } from "libp2p/fetch"
import { CircuitRelayService, circuitRelayServer } from "libp2p/circuit-relay"

import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import type { PubSub } from "@libp2p/interface/pubsub"
import { peerIdFromString } from "@libp2p/peer-id"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { DiscoveryService, discovery } from "@canvas-js/discovery"
import { GossipLogService, gossiplog } from "@canvas-js/gossiplog/service"

import { second, minute, MIN_CONNECTIONS, MAX_CONNECTIONS } from "./constants.js"
import { peerId, bootstrapList, listen, announce, discoveryTopic } from "./config.js"

async function denyDialMultiaddr(addr: Multiaddr) {
	const transportRoot = addr.decapsulate("/ws")
	if (transportRoot.isThinWaistAddress() && isLoopback(transportRoot)) {
		return true
	}

	const relayRoot = addr.decapsulateCode(290) // /p2p-circuit
	if (relayRoot.getPeerId() === peerId.toString()) {
		return true
	}

	if (
		bootstrapList
			.map(multiaddr)
			.map((addr) => addr.getPeerId()?.toString())
			.indexOf(peerId.toString())
	) {
		return true
	}

	return false
}

export type ServiceMap = {
	identify: {}
	ping: PingService
	relay: CircuitRelayService
	pubsub: PubSub<GossipsubEvents>
	fetch: FetchService
	discovery: DiscoveryService
	gossiplog: GossipLogService
}

export const options: Libp2pOptions<ServiceMap> = {
	peerId,
	start: false,
	addresses: { listen, announce },
	transports: [webSockets({ filter: all })],
	connectionGater: { denyDialMultiaddr },
	connectionManager: {
		minConnections: MIN_CONNECTIONS,
		maxConnections: MAX_CONNECTIONS,
	},

	peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

	streamMuxers: [mplex()],
	connectionEncryption: [noise()],
	metrics: prometheusMetrics(),
	services: {
		identify: identifyService({ protocolPrefix: "canvas" }),

		ping: pingService({
			protocolPrefix: "canvas",
			maxInboundStreams: 256,
			maxOutboundStreams: 64,
			timeout: 20 * second,
		}),

		relay: circuitRelayServer({
			hopTimeout: 10 * second, // incoming relay requests must be resolved within this time limit
			advertise: false,
			reservations: {
				maxReservations: 1024, // how many peers are allowed to reserve relay slots on this server
				reservationClearInterval: 1 * minute, // how often to reclaim stale reservations
				applyDefaultLimit: true, // whether to apply default data/duration limits to each relayed connection
				reservationTtl: 15 * minute,

				// defaultDurationLimit: 15 * minute, // the default maximum amount of time a relayed connection can be open for
				// defaultDataLimit: 4_000_000_000n, // the default maximum number of bytes that can be transferred over a relayed connection
				// defaultDurationLimit: 1 * minute, // the default maximum amount of time a relayed connection can be open for
				// defaultDataLimit: 1_000_000n, // the default maximum number of bytes that can be transferred over a relayed connection
			},

			// how many inbound HOP streams are allow simultaneously
			maxInboundHopStreams: 1024,

			// how many outbound HOP streams are allow simultaneously
			maxOutboundHopStreams: 1024,
		}),

		pubsub: gossipsub({
			doPX: true,
			canRelayMessage: true,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictNoSign",
			// directPeers: bootstrapList.map(multiaddr).map((addr) => {
			// 	const id = addr.getPeerId()
			// 	assert(id !== null)
			// 	return { id: peerIdFromString(id), addrs: [addr] }
			// }),
			scoreParams: {
				behaviourPenaltyWeight: -1.0, // 1/10th of default
				retainScore: 10 * 1000, // 10 seconds, instead of 1 hour
			},
			scoreThresholds: {
				gossipThreshold: -10, // default is -10
				publishThreshold: -50, // default is -50
				graylistThreshold: -80, // default is -80
			},
		}),

		fetch: fetchService({ protocolPrefix: "canvas" }),
		gossiplog: gossiplog({}),
		discovery: discovery({
			discoveryTopic: discoveryTopic,
			addressFilter: (addr) => WebSockets.matches(addr) || WebSocketsSecure.matches(addr),
		}),
	},
}
