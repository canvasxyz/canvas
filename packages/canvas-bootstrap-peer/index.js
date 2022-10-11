import { createLibp2p } from "libp2p"
import { WebSockets } from "@libp2p/websockets"
import { Noise } from "@chainsafe/libp2p-noise"
import { Mplex } from "@libp2p/mplex"
import { KadDHT } from "@libp2p/kad-dht"
import { Bootstrap } from "@libp2p/bootstrap"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"

const peerId = await createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))

const bootstrapList = process.env.BOOTSTRAP_LIST.split(" ")

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
	transports: [new WebSockets()],
	connectionEncryption: [new Noise()],
	streamMuxers: [new Mplex()],
	peerDiscovery: [new Bootstrap({ list: bootstrapList })],
	dht: new KadDHT({ protocolPrefix: "/canvas", clientMode: false }),
	relay: {
		enabled: true,
		hop: {
			timeout: 2147483647,
			enabled: true,
			active: true,
		},
	},
})

await libp2p.start()

process.on("SIGINT", () => libp2p.stop())
