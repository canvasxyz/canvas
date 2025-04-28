import { createLibp2p } from "libp2p"
import { generateKeyPair } from "@libp2p/crypto/keys"
import { Libp2p, MultiaddrConnection, PeerId, PrivateKey, PubSub } from "@libp2p/interface"
import { Identify, identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { KadDHT, kadDHT } from "@libp2p/kad-dht"
import { Ping, ping } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub"
export { GossipSub } from "@chainsafe/libp2p-gossipsub"

import type { Registry } from "prom-client"

import { Multiaddr } from "@multiformats/multiaddr"

import { RendezvousClient, rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"
import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { defaultBootstrapList } from "@canvas-js/gossiplog/bootstrap"

import { GossipLogService, gossipLogService } from "./service.js"

export interface NetworkConfig {
	/** start libp2p on initialization (default: true) */
	start?: boolean
	privateKey?: PrivateKey

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]
	denyDialMultiaddr?(multiaddr: Multiaddr): Promise<boolean> | boolean
	denyInboundConnection?(maConn: MultiaddrConnection): Promise<boolean> | boolean

	maxConnections?: number
	registry?: Registry
}

export type ServiceMap<Payload> = {
	identify: Identify
	ping: Ping
	pubsub: PubSub<GossipsubEvents>
	gossipLog: GossipLogService<Payload>
	dht: KadDHT
	rendezvous: RendezvousClient
}

const getDHTProtocol = (topic: string) => `/canvas/kad/1.0.0/${topic}`

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
			maxIncomingPendingConnections: 256,
			inboundConnectionThreshold: 16,
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
