import dns from "node:dns"

import { createLibp2p } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { kadDHT } from "@libp2p/kad-dht"
import { bootstrap } from "@libp2p/bootstrap"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"

const { PEER_ID, BOOTSTRAP_LIST, PORT, FLY_APP_NAME } = process.env

const bootstrapList = BOOTSTRAP_LIST.split(" ")

const peerId = await createFromProtobuf(Buffer.from(PEER_ID, "base64"))

const RELAY_HOP_TIMEOUT = 0x7fffffff

const address = await new Promise((resolve, reject) => {
	dns.resolve(`${FLY_APP_NAME}.fly.dev`, (err, [address]) => {
		if (err || address === undefined) {
			reject(err)
		} else {
			resolve(address)
		}
	})
})

const listen = [`/ip4/0.0.0.0/tcp/${PORT}/ws`]
const announce = [`/ip4/${address}/tcp/${PORT}/ws`]
const announceFilter = (multiaddrs) => multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const libp2p = await createLibp2p({
	peerId,
	addresses: { listen, announce, announceFilter },
	connectionGater: { denyDialMultiaddr: async (peerId, multiaddr) => isLoopback(multiaddr) },
	transports: [webSockets()],
	connectionEncryption: [noise()],
	streamMuxers: [mplex()],
	peerDiscovery: [bootstrap({ list: bootstrapList })],
	dht: kadDHT({ protocolPrefix: "/canvas", clientMode: false }),
	relay: {
		enabled: true,
		hop: {
			timeout: RELAY_HOP_TIMEOUT,
			enabled: true,
			active: true,
		},
	},
})

await libp2p.start()

process.on("SIGINT", () => libp2p.stop())
