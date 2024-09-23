import { ExecutionContext } from "ava"

import { createLibp2p, Libp2pOptions } from "libp2p"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { Identify, identify } from "@libp2p/identify"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

import { rendezvousServer } from "@canvas-js/libp2p-rendezvous/server"
import { rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"
import { Libp2p, ServiceMap } from "@libp2p/interface"

export interface Config {
	port: number
	name?: string
	start?: boolean
}

export async function getLibp2p<T extends ServiceMap>(
	t: ExecutionContext,
	config: Config,
	services: Libp2pOptions<T>["services"],
): Promise<Libp2p<T & { identify: Identify }>> {
	const peerId = await createEd25519PeerId()

	const { port, name = peerId.toString(), start = true } = config

	const libp2p = await createLibp2p({
		peerId,
		start: false,
		addresses: {
			listen: [`/ip4/127.0.0.1/tcp/${port}/ws`],
			announce: [`/ip4/127.0.0.1/tcp/${port}/ws`],
		},
		transports: [webSockets({ filter: all })],
		connectionMonitor: { enabled: false },
		streamMuxers: [yamux()],
		connectionEncryption: [noise({})],
		services: {
			...services,
			identify: identify({ protocolPrefix: "canvas" }),
		},
	})

	t.teardown(() => libp2p.stop())

	// libp2p.addEventListener("start", async () => {
	// 	console.log(`[${name}] libp2p started`)
	// })

	// libp2p.addEventListener("stop", () => {
	// 	console.log(`[${name}] libp2p stopped`)
	// })

	// libp2p.addEventListener("connection:open", ({ detail: { remotePeer, remoteAddr } }) => {
	// 	console.log(`[${name}] connection:open ${remotePeer} ${remoteAddr}`)
	// })

	// libp2p.addEventListener("connection:close", ({ detail: { remotePeer, remoteAddr } }) => {
	// 	console.log(`[${name}] connection:close ${remotePeer} ${remoteAddr}`)
	// })

	if (start) {
		await libp2p.start()
	}

	return libp2p as Libp2p<T & { identify: Identify }>
}
