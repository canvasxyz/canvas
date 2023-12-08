import { Libp2pOptions } from "libp2p"
import { PingService, ping as pingService } from "@libp2p/ping"
import { identify as identifyService } from "@libp2p/identify"
import { Fetch as FetchService, fetch as fetchService } from "@libp2p/fetch"

import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import type { PubSub } from "@libp2p/interface"
import { Multiaddr } from "@multiformats/multiaddr"

import { DiscoveryService, discovery } from "@canvas-js/discovery"
import { GossipLogService, gossiplog } from "@canvas-js/gossiplog/service"

import { MIN_CONNECTIONS, MAX_CONNECTIONS, PING_TIMEOUT } from "./constants.js"
import { peerId, bootstrapList, listen, announce } from "./config.js"

async function denyDialMultiaddr(addr: Multiaddr) {
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
		minConnections: Math.max(MIN_CONNECTIONS, bootstrapList.length),
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
			maxInboundStreams: 2048,
			maxOutboundStreams: 64,
			timeout: PING_TIMEOUT,
		}),

		pubsub: gossipsub({
			doPX: true,
			canRelayMessage: true,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictNoSign",
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
			addressFilter: (addr) => WebSockets.matches(addr) || WebSocketsSecure.matches(addr),
		}),
	},
}
