import { createLibp2p } from "libp2p"
import { CircuitRelayService, circuitRelayServer } from "@libp2p/circuit-relay-v2"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { plaintext } from "@libp2p/plaintext"
import { Identify, identify } from "@libp2p/identify"
import { Fetch, fetch } from "@libp2p/fetch"
import { PingService, ping } from "@libp2p/ping"

import { listen, announce, getPeerId } from "./config.js"

export async function getLibp2p() {
	const peerId = await getPeerId()

	return await createLibp2p<{ identify: Identify; circuitRelay: CircuitRelayService; fetch: Fetch; ping: PingService }>(
		{
			peerId: peerId,
			start: false,
			addresses: { listen, announce },
			transports: [webSockets({ filter: all })],

			streamMuxers: [yamux()],
			connectionEncryption: [plaintext({})],
			services: {
				identify: identify({ protocolPrefix: "canvas" }),
				circuitRelay: circuitRelayServer(),
				fetch: fetch({ protocolPrefix: "canvas" }),
				ping: ping({ protocolPrefix: "canvas" }),
			},
		},
	)
}
