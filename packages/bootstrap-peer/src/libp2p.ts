import { createLibp2p } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { Identify, identify } from "@libp2p/identify"
import { PingService, ping } from "@libp2p/ping"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"

import { rendezvousServer, RendezvousServer } from "@canvas-js/libp2p-rendezvous/server"

import { Config, getConfig } from "./config.js"

export type ServiceMap = {
	identify: Identify
	ping: PingService
	rendezvous: RendezvousServer
}

export const maxRegistrationTTL = 2 * 60 * 60 // 2h

export async function getLibp2p(config: Partial<Config> = {}) {
	const { path, privateKey, listen, announce, maxConnections } = await getConfig(config)
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

	const libp2p = await createLibp2p<ServiceMap>({
		privateKey: privateKey,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({})],
		connectionGater: { denyDialMultiaddr: (addr) => false },
		connectionManager: { maxConnections },
		connectionMonitor: { enabled: false, protocolPrefix: "canvas" },

		peerStore: {
			maxAddressAge: maxRegistrationTTL * 1000,
			maxPeerAge: maxRegistrationTTL * 1000,
		},

		streamMuxers: [yamux()],
		connectionEncrypters: [noise({})],

		metrics: prometheusMetrics({}),

		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),
			rendezvous: rendezvousServer({ path, maxRegistrationTTL }),
		},
	})

	return libp2p
}
