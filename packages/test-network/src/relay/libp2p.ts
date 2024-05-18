import { createLibp2p } from "libp2p"
import { circuitRelayServer } from "@libp2p/circuit-relay-v2"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
// import { yamux } from "@chainsafe/libp2p-yamux"
import { mplex } from "@libp2p/mplex"
import { plaintext } from "@libp2p/plaintext"
import { identify } from "@libp2p/identify"
import { fetch } from "@libp2p/fetch"
import { ping } from "@libp2p/ping"

import { listen, announce, getPeerId } from "./config.js"

export async function getLibp2p() {
	const peerId = await getPeerId()

	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],

		// streamMuxers: [yamux()],
		streamMuxers: [mplex()],
		connectionEncryption: [plaintext({})],
		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			circuitRelay: circuitRelayServer(),
			fetch: fetch({ protocolPrefix: "canvas" }),
		},
	})
}
