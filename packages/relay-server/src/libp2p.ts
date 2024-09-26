import { createLibp2p } from "libp2p"
import { yamux } from "@chainsafe/libp2p-yamux"
import { CircuitRelayService, circuitRelayServer } from "@libp2p/circuit-relay-v2"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { Identify, identify } from "@libp2p/identify"
import { PingService, ping } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { Config, getConfig } from "./config.js"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"

export type ServiceMap = {
	identify: Identify
	circuitRelay: CircuitRelayService
	ping: PingService
}

export async function getLibp2p(config: Partial<Config> = {}) {
	const { privateKey, listen, announce, maxConnections } = await getConfig(config)

	const peerId = peerIdFromPrivateKey(privateKey)
	console.log("using PeerId", peerId.toString())

	console.log(
		"listening on",
		listen.map((addr) => `${addr}/p2p/${peerId}`),
	)

	console.log(
		"announcing on",
		announce.map((addr) => `${addr}/p2p/${peerId}`),
	)

	return await createLibp2p<ServiceMap>({
		privateKey: privateKey,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		connectionManager: { maxConnections },
		connectionMonitor: { protocolPrefix: "canvas" },

		streamMuxers: [yamux()],
		connectionEncrypters: [noise({})],

		metrics: prometheusMetrics({}),

		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			circuitRelay: circuitRelayServer({
				reservations: {
					maxReservations: 256,
					reservationClearInterval: 1 * 60 * 1000,
				},
			}),
			ping: ping({ protocolPrefix: "canvas" }),
		},
	})
}
