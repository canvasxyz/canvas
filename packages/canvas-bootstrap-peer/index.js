import { createLibp2p } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { kadDHT } from "@libp2p/kad-dht"
import { bootstrap } from "@libp2p/bootstrap"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"

const bootstrapList = process.env.BOOTSTRAP_LIST.split(" ")

const peerId = await createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))

const RELAY_HOP_TIMEOUT = 0x7fffffff

const libp2p = await createLibp2p({
	peerId,
	addresses: {
		listen: [`/ip4/0.0.0.0/tcp/${process.env.PORT}/ws`],
		announce: [process.env.ANNOUNCE],
		announceFilter: (multiaddrs) => multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr)),
	},
	connectionGater: {
		denyDialMultiaddr: async (peerId, multiaddr) => isLoopback(multiaddr),
	},
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
