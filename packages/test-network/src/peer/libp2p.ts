import { sha256 } from "@noble/hashes/sha256"

import { createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"

import { Multiaddr } from "@multiformats/multiaddr"

import { gossiplog } from "@canvas-js/gossiplog/service"

import { bootstrapList, listen, announce, peerId } from "./config.js"

const { MIN_CONNECTIONS, MAX_CONNECTIONS, SERVICE_NAME } = process.env
const serviceNameHash = sha256(SERVICE_NAME ?? new Uint8Array([]))

export const topic = serviceNameHash[0] < 128 ? "test-network-example" : null

// export const topic = "test-network-example"

let minConnections: number | undefined = undefined
let maxConnections: number | undefined = undefined

if (MIN_CONNECTIONS !== undefined) minConnections = parseInt(MIN_CONNECTIONS)
if (MAX_CONNECTIONS !== undefined) maxConnections = parseInt(MAX_CONNECTIONS)

export const libp2p = await createLibp2p({
	peerId: peerId,
	start: false,
	addresses: { listen, announce },
	transports: [webSockets({ filter: all })],
	connectionGater: {
		denyDialMultiaddr: (addr: Multiaddr) => false,
	},

	connectionManager: { minConnections, maxConnections },

	peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

	streamMuxers: [mplex()],
	connectionEncryption: [noise()],
	// metrics: prometheusMetrics(),
	services: {
		identify: identifyService({ protocolPrefix: "canvas" }),
		globalDHT: kadDHT({
			kBucketSize: 2,
			validators: { "": () => Promise.reject("storing DHT records is not supported") },
		}),

		// topicDHT: kadDHT({
		// 	kBucketSize: 5,
		// 	validators: { "": () => Promise.reject("storing DHT records is not supported") },
		// }),

		pubsub: gossipsub({
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictNoSign",
			metricsTopicStrToLabel: new Map<string, string>(topic ? [[topic, topic]] : []),
			metricsRegister: {
				gauge({}) {
					return {
						inc: () => {},
						set: () => {},
						addCollect: () => {},
					}
				},
				histogram({}) {
					return {
						startTimer: () => () => {},
						observe: () => {},
						reset: () => {},
					}
				},
				avgMinMax({}) {
					return {
						set: () => {},
					}
				},
			},
		}),

		gossiplog: gossiplog({}),
	},
})
