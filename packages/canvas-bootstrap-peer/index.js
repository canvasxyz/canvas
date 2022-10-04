import { createLibp2p } from "libp2p"
// import { TCP } from "@libp2p/tcp"
import { WebSockets } from "@libp2p/websockets"
import { Noise } from "@chainsafe/libp2p-noise"
import { Mplex } from "@libp2p/mplex"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
// import { MulticastDNS } from "@libp2p/mdns"

const peerId = await createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))

const libp2p = await createLibp2p({
	peerId,
	addresses: {
		listen: [`/ip4/0.0.0.0/tcp/${process.env.PORT}/ws`],
		announce: [`/dns4/bootstrap.slacker.house`],
		announceFilter: (multiaddrs) => multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr)),
	},
	// transports: [new TCP()],
	transports: [new WebSockets()],
	connectionEncryption: [new Noise()],
	streamMuxers: [new Mplex()],
	pubsub: new GossipSub({ doPX: true, fallbackToFloodsub: false, globalSignaturePolicy: "StrictSign" }),
})

await libp2p.start()

process.on("SIGINT", () => libp2p.stop())
