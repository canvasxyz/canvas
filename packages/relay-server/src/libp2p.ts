import { createLibp2p } from "libp2p"
import { yamux } from "@chainsafe/libp2p-yamux"
import { CircuitRelayService, circuitRelayServer } from "@libp2p/circuit-relay-v2"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { Identify, identify } from "@libp2p/identify"
import { Fetch, fetch } from "@libp2p/fetch"
import { PingService, ping } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { listen, announce, getPeerId } from "./config.js"

const { MIN_CONNECTIONS = "0", MAX_CONNECTIONS = "1024" } = process.env

export async function getLibp2p() {
	const peerId = await getPeerId()

	console.log("using PeerId", peerId.toString())
	console.log("listening on", listen)
	console.log(
		"announcing on",
		announce.map((addr) => `${addr}/p2p/${peerId}`),
	)

	return await createLibp2p<{ identify: Identify; circuitRelay: CircuitRelayService; fetch: Fetch; ping: PingService }>(
		{
			peerId: peerId,
			start: false,
			addresses: { listen, announce },
			transports: [webSockets({ filter: all })],
			connectionManager: {
				minConnections: parseInt(MIN_CONNECTIONS),
				maxConnections: parseInt(MAX_CONNECTIONS),
			},

			streamMuxers: [yamux()],
			connectionEncryption: [noise({})],

			metrics: prometheusMetrics({}),

			services: {
				identify: identify({ protocolPrefix: "canvas" }),
				circuitRelay: circuitRelayServer({
					reservations: {
						maxReservations: 256,
						reservationClearInterval: 1 * 60 * 1000,
					},
				}),
				fetch: fetch({ protocolPrefix: "canvas" }),
				ping: ping({ protocolPrefix: "canvas" }),
			},
		},
	)
}
