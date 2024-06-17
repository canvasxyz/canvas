import { createLibp2p } from "libp2p"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
// import { noise } from "@chainsafe/libp2p-noise"
import { plaintext } from "@libp2p/plaintext"
import { yamux } from "@chainsafe/libp2p-yamux"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { webRTC } from "@libp2p/webrtc"
import { kadDHT } from "@libp2p/kad-dht"
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"
import { fetch } from "@libp2p/fetch"
import { ping } from "@libp2p/ping"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import { topic, getTopicDHTProtocol } from "../../constants.js"
import { bootstrapList, minConnections, maxConnections, listen, announce, peerId } from "./config.js"

export async function getLibp2p(messageLog: AbstractGossipLog<string>) {
	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all }), webRTC({}), circuitRelayTransport({ discoverRelays: 1 })],
		// connectionGater: {
		// 	denyDialMultiaddr: (addr: Multiaddr) => false,
		// },

		connectionManager: { minConnections, maxConnections },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [yamux({})],
		connectionEncryption: [plaintext({})],
		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			fetch: fetch({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),

			dht: kadDHT({ protocol: getTopicDHTProtocol(topic) }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictNoSign",

				asyncValidation: true,
				scoreParams: {
					IPColocationFactorWeight: 0,
				},
			}),

			gossiplog: gossiplog(messageLog, {}),
		},
	})
}
