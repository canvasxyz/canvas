import { createLibp2p } from "libp2p"
import { identify as identifyService } from "@libp2p/identify"

import { Multiaddr } from "@multiformats/multiaddr"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import { bootstrapList, listen, announce, peerId } from "./config.js"

export const topic = "test-network-example"

export const libp2p = await createLibp2p({
	peerId: peerId,
	start: false,
	addresses: { listen, announce },
	transports: [webSockets({ filter: all })],
	connectionGater: {
		denyDialMultiaddr: (addr: Multiaddr) => false,
	},

	peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

	streamMuxers: [mplex()],
	connectionEncryption: [noise()],
	// metrics: prometheusMetrics(),
	services: {
		identify: identifyService({ protocolPrefix: "canvas" }),
		pubsub: gossipsub({
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictNoSign",
			metricsTopicStrToLabel: new Map<string, string>([[topic, topic]]),
			metricsRegister: {
				gauge(config) {
					return {
						inc: () => {},
						set: () => {},
						addCollect: () => {},
					}
				},
				histogram(config) {
					return {
						startTimer: () => () => {},
						observe: () => {},
						reset: () => {},
					}
				},
				avgMinMax(config) {
					return {
						set: () => {},
					}
				},
			},
		}),
	},
})
