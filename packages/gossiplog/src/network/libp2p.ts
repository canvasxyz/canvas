import { createLibp2p } from "libp2p"
import { Libp2p } from "@libp2p/interface"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { ping as pingService } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { Multiaddr } from "@multiformats/multiaddr"

import type { ServiceMap, NetworkConfig } from "../interface.js"

import { getPeerId } from "./peerId.js"

const getDHTProtocol = (topic: string | null) => (topic === null ? `/canvas/kad/1.0.0` : `/canvas/kad/1.0.0/${topic}`)

export async function getLibp2p(topic: string, config: NetworkConfig): Promise<Libp2p<ServiceMap>> {
	let peerId = config.peerId
	if (peerId === undefined) {
		peerId = await getPeerId()
	}

	const bootstrapList = config.bootstrapList ?? []
	const listen = config.listen ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ["/ip4/127.0.0.1/tcp/8080/ws"]

	return await createLibp2p({
		peerId: config.peerId,
		start: config.start ?? false,
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

			topicDHT: kadDHT({ protocol: getDHTProtocol(topic) }),
			globalDHT: kadDHT({ protocol: getDHTProtocol(null) }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictNoSign",
				asyncValidation: true,
				scoreParams: { IPColocationFactorWeight: 0 },
			}),
		},
	})
}
