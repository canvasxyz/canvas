import { Libp2p, createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
// import { noise } from "@chainsafe/libp2p-noise"
import { plaintext } from "@libp2p/plaintext"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { fetch } from "@libp2p/fetch"

import { Multiaddr } from "@multiformats/multiaddr"
import { randomBytes } from "@noble/hashes/utils"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import type { ServiceMap } from "../../types.js"
import { bootstrapList, minConnections, maxConnections, listen, announce, getPeerId } from "./config.js"

export const topic = "test-network-example"

export const getTopicDHTProtocol = (topic: string) => `/canvas/kad/${topic}/1.0.0`

export async function getLibp2p(messageLog: AbstractGossipLog<Uint8Array>): Promise<Libp2p<ServiceMap>> {
	const peerId = await getPeerId()

	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		// transports: [webSockets({ filter: dnsWsOrWss })],
		connectionGater: {
			denyDialMultiaddr: (addr: Multiaddr) => false,
		},

		connectionManager: { minConnections, maxConnections },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [mplex()],
		connectionEncryption: [plaintext({})],
		services: {
			identify: identifyService({ protocolPrefix: "canvas", timeout: 20000 }),

			// dht: kadDHT({ protocol: getTopicDHTProtocol(topic) }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictSign",

				asyncValidation: true,
			}),

			fetch: fetch({ protocolPrefix: "canvas" }),

			gossiplog: gossiplog(messageLog, {}),
		},
	})
}
