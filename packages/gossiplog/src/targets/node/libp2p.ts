import { createLibp2p } from "libp2p"
import { generateKeyPair } from "@libp2p/crypto/keys"
import { Libp2p, MultiaddrConnection, PeerId } from "@libp2p/interface"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { KadDHT, kadDHT } from "@libp2p/kad-dht"
import { ping } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import { Multiaddr } from "@multiformats/multiaddr"
import { rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { NetworkConfig, ServiceMap, gossipLogService } from "@canvas-js/gossiplog/libp2p"
import { defaultBootstrapList } from "@canvas-js/gossiplog/bootstrap"

import { getDHTProtocol } from "../../utils.js"

export async function getLibp2p<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	config: NetworkConfig,
): Promise<Libp2p<ServiceMap<Payload>>> {
	let privateKey = config.privateKey
	if (privateKey === undefined) {
		privateKey = await generateKeyPair("Ed25519")
	}

	const bootstrapList = config.bootstrapList ?? defaultBootstrapList
	const listen = config.listen ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ["/ip4/127.0.0.1/tcp/8080/ws"]

	const libp2p = await createLibp2p({
		privateKey: privateKey,
		start: config.start ?? true,
		addresses: { listen, announce },
		transports: [webSockets({})],
		connectionGater: {
			denyDialMultiaddr: config.denyDialMultiaddr ?? ((addr: Multiaddr) => false),
			denyInboundConnection: config.denyInboundConnection ?? ((maConn: MultiaddrConnection) => false),
		},

		connectionManager: {
			maxConnections: config.maxConnections,
			maxIncomingPendingConnections: config.maxIncomingPendingConnections ?? 256,
			inboundConnectionThreshold: config.inboundConnectionThreshold ?? 16,
		},

		connectionMonitor: { enabled: false, protocolPrefix: "canvas" },

		streamMuxers: [yamux()],
		connectionEncrypters: [noise({})],

		metrics: prometheusMetrics({ registry: config.registry }),

		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),

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
				autoRegister: {
					multiaddrs: bootstrapList,
					namespaces: [gossipLog.topic],
				},
				autoDiscover: true,
			}),
		},
	})

	libp2p.services.rendezvous.addEventListener("peer", ({ detail: peerInfo }) => {
		const dht = libp2p.services.dht as KadDHT & {
			routingTable: { size: number; add: (peerId: PeerId) => Promise<void> }
		}

		dht.routingTable.add(peerInfo.id)
	})

	return libp2p
}
