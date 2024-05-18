import { createLibp2p } from "libp2p"
import type { Libp2p } from "@libp2p/interface"
import type { Multiaddr } from "@multiformats/multiaddr"

import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
// import { noise } from "@chainsafe/libp2p-noise"
import { plaintext } from "@libp2p/plaintext"
// import { yamux } from "@chainsafe/libp2p-yamux"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
// import { kadDHT } from "@libp2p/kad-dht"
import { ping } from "@libp2p/ping"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import type { ServiceMap } from "../types.js"
// import { topic, getTopicDHTProtocol } from "../constants.js"
import { bootstrapList, listen, announce, getPeerId } from "./config.js"

const { MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

let minConnections: number | undefined = undefined
let maxConnections: number | undefined = undefined

if (MIN_CONNECTIONS !== undefined) minConnections = parseInt(MIN_CONNECTIONS)
if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

export async function getLibp2p(messageLog: AbstractGossipLog<Uint8Array>): Promise<Libp2p<ServiceMap>> {
	const peerId = await getPeerId()

	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		connectionGater: {
			denyDialMultiaddr: (addr: Multiaddr) => false,
		},

		connectionManager: { minConnections, maxConnections },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		// streamMuxers: [yamux()],
		streamMuxers: [mplex()],
		connectionEncryption: [plaintext({})],
		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),
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
