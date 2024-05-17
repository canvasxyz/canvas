import { createLibp2p } from "libp2p"
import type { Libp2p } from "@libp2p/interface"
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

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import type { ServiceMap } from "../types.js"
import { bootstrapList, listen, announce, getPeerId } from "./config.js"

const { MIN_CONNECTIONS, MAX_CONNECTIONS } = process.env

export const topic = "test-network-example"

let minConnections: number | undefined = undefined
let maxConnections: number | undefined = undefined

if (MIN_CONNECTIONS !== undefined) minConnections = parseInt(MIN_CONNECTIONS)
if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

export const getTopicDHTProtocol = (topic: string) => `/canvas/kad/${topic}/1.0.0`

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

		connectionManager: { minConnections, maxConnections, inboundUpgradeTimeout: 10000 },

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
				scoreParams: {
					IPColocationFactorWeight: 0,
				},
			}),

			fetch: fetch({ protocolPrefix: "canvas" }),

			gossiplog: gossiplog(messageLog, {}),
		},
	})
}
