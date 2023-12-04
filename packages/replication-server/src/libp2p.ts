import assert from "node:assert"

import { Libp2pOptions } from "libp2p"
import { PingService, ping as pingService } from "@libp2p/ping"
import { Identify as IdentifyService, identify as identifyService } from "@libp2p/identify"
import { Fetch as FetchService, fetch as fetchService } from "@libp2p/fetch"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import type { PubSub } from "@libp2p/interface"
import { peerIdFromString } from "@libp2p/peer-id"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"
import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

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
	identify: IdentifyService
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
		}),

		fetch: fetchService({ protocolPrefix: "canvas" }),
		gossiplog: gossiplog({}),
		discovery: discovery({
			discoveryTopic: discoveryTopic,
			addressFilter: (addr) => WebSockets.matches(addr) || WebSocketsSecure.matches(addr),
		}),
	},
}
