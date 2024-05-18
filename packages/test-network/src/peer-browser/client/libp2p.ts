import { Libp2p, createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
// import { noise } from "@chainsafe/libp2p-noise"
import { plaintext } from "@libp2p/plaintext"
import { yamux } from "@chainsafe/libp2p-yamux"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"

import { Multiaddr } from "@multiformats/multiaddr"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import type { ServiceMap } from "../../types.js"
import { bootstrapList, minConnections, maxConnections, listen, announce, peerId } from "./config.js"

export const topic = "test-network-example"

export const getTopicDHTProtocol = (topic: string) => `/canvas/kad/${topic}/1.0.0`

export async function getLibp2p(messageLog: AbstractGossipLog<Uint8Array>): Promise<Libp2p<ServiceMap>> {
	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all }), circuitRelayTransport({})],
		connectionGater: {
			denyDialMultiaddr: (addr: Multiaddr) => false,
		},

		connectionManager: { minConnections, maxConnections },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [yamux({})],
		connectionEncryption: [plaintext({})],
		services: {
			identify: identifyService({ protocolPrefix: "canvas" }),

			// dht: kadDHT({ protocol: getTopicDHTProtocol(topic) }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictSign",

				asyncValidation: true,
				scoreParams: {
					IPColocationFactorWeight: 0,
				},
			}),

			gossiplog: gossiplog(messageLog, {}),
		},
	})
}
