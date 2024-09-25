import { createLibp2p } from "libp2p"
import { Libp2p, PeerId, PubSub } from "@libp2p/interface"
import { Identify, identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { bootstrap } from "@libp2p/bootstrap"
import { KadDHT, kadDHT } from "@libp2p/kad-dht"
import { PingService, ping as pingService } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

export { GossipSub } from "@chainsafe/libp2p-gossipsub"

import type { Registry } from "prom-client"

import { Multiaddr } from "@multiformats/multiaddr"

import { RendezvousClient, rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"
import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { defaultBootstrapList } from "@canvas-js/gossiplog/bootstrap"

import { GossipLogService, gossipLogService } from "./service.js"

export interface NetworkConfig {
	start?: boolean
	peerId?: PeerId

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]

	minConnections?: number
	maxConnections?: number

	registry?: Registry
}

export type ServiceMap<Payload> = {
	identify: Identify
	ping: PingService
	pubsub: PubSub<GossipsubEvents>
	gossipLog: GossipLogService<Payload>
	dht: KadDHT
	rendezvous: RendezvousClient
}

const getDHTProtocol = (topic: string | null) => (topic === null ? `/canvas/kad/1.0.0` : `/canvas/kad/1.0.0/${topic}`)

export async function getLibp2p<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	config: NetworkConfig,
): Promise<Libp2p<ServiceMap<Payload>>> {
	let peerId = config.peerId
	if (peerId === undefined) {
		peerId = await createEd25519PeerId()
	}

	const bootstrapList = config.bootstrapList ?? defaultBootstrapList
	const listen = config.listen ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ["/ip4/127.0.0.1/tcp/8080/ws"]

	return await createLibp2p({
		peerId: config.peerId,
		start: config.start ?? true,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		connectionGater: {
			denyDialMultiaddr: (addr: Multiaddr) => false,
		},

		connectionManager: {
			minConnections: config.minConnections,
			maxConnections: config.maxConnections,
			maxIncomingPendingConnections: 256,
			inboundConnectionThreshold: 16,
		},

		connectionMonitor: { protocolPrefix: "canvas" },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [yamux()],
		connectionEncryption: [noise({})],

		metrics: prometheusMetrics({ registry: config.registry }),

		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: pingService({ protocolPrefix: "canvas" }),

			dht: kadDHT({ protocol: getDHTProtocol(gossipLog.topic) }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictNoSign",
				asyncValidation: true,
				scoreParams: { IPColocationFactorWeight: 0 },
			}),

			gossipLog: gossipLogService({ gossipLog: gossipLog }),

			rendezvous: rendezvousClient({
				autoRegister: [gossipLog.topic],
				autoDiscover: true,
			}),
		},
	})
}
