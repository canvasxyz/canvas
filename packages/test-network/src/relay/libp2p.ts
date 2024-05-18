import { createLibp2p } from "libp2p"
import { circuitRelayServer } from "@libp2p/circuit-relay-v2"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { plaintext } from "@libp2p/plaintext"
import { identify as identifyService } from "@libp2p/identify"

import { listen, announce, getPeerId } from "./config.js"

export async function getLibp2p() {
	const peerId = await getPeerId()

	return await createLibp2p({
		peerId: peerId,
		start: false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],

		streamMuxers: [yamux()],
		connectionEncryption: [plaintext({})],
		services: {
			identify: identifyService({ protocolPrefix: "canvas" }),
			circuitRelay: circuitRelayServer(),
		},
	})
}
