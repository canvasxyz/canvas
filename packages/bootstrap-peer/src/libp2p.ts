import { createLibp2p } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { Identify, identify } from "@libp2p/identify"
import { PingService, ping } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { rendezvousServer, RendezvousServer } from "@canvas-js/libp2p-rendezvous/server"

import { Config, getConfig } from "./config.js"

export type ServiceMap = {
	identify: Identify
	ping: PingService
	rendezvous: RendezvousServer
}

export async function getLibp2p(config: Partial<Config> = {}) {
	const { path, peerId, listen, announce, minConnections, maxConnections } = await getConfig(config)
	console.log("using PeerId", peerId.toString())

	console.log(
		"listening on",
		listen.map((addr) => `${addr}/p2p/${peerId}`),
	)

	console.log(
		"announcing on",
		announce.map((addr) => `${addr}/p2p/${peerId}`),
	)

	const libp2p = await createLibp2p<ServiceMap>({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		connectionManager: { minConnections, maxConnections },
		connectionMonitor: { protocolPrefix: "canvas" },

		streamMuxers: [yamux()],
		connectionEncryption: [noise({})],

		metrics: prometheusMetrics({}),

		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),
			rendezvous: rendezvousServer({ path }),
		},
	})

	return libp2p
}
