import assert from "node:assert"

import { Libp2pOptions } from "libp2p"
import { PingService, pingService } from "libp2p/ping"
import { identifyService } from "libp2p/identify"
import { FetchService, fetchService } from "libp2p/fetch"

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

	return false
}

export type ServiceMap = {
	identify: {}
	ping: PingService
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

	streamMuxers: [mplex({ disconnectThreshold: 500 })],
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

		pubsub: gossipsub({
			doPX: true,
			canRelayMessage: true,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictNoSign",
			directPeers: bootstrapList.map(multiaddr).map((addr) => {
				const id = addr.getPeerId()
				assert(id !== null)
				return { id: peerIdFromString(id), addrs: [addr] }
			}),
			scoreParams: {
				behaviourPenaltyWeight: -1.0, // 1/10th of default
				retainScore: 10 * 1000, // 10 seconds, instead of 1 hour
			},
			scoreThresholds: {
				gossipThreshold: -999_999_999, // default is -10
				publishThreshold: -999_999_999, // default is -50
				graylistThreshold: -999_999_999, // default is -80
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
