import { createLibp2p } from "libp2p"
import type { Libp2p, PeerId } from "@libp2p/interface"
import type { Multiaddr } from "@multiformats/multiaddr"
import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { ping as pingService } from "@libp2p/ping"
import { fetch as fetchService } from "@libp2p/fetch"

import { discovery } from "@canvas-js/discovery"

import type { ServiceMap, NetworkConfig } from "../../interface.js"

export function getTopicDHTProtocol(topic?: string) {
	if (topic !== undefined) {
		return `/canvas/kad/1.0.0/${topic}`
	} else {
		return `/canvas/kad/1.0.0`
	}
}

export async function getPeerId(): Promise<PeerId> {
	const { PEER_ID } = process.env
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}

export async function getLibp2p(config: NetworkConfig): Promise<Libp2p<ServiceMap>> {
	let peerId = config.peerId
	if (peerId === undefined) {
		peerId = await getPeerId()
	}

	const bootstrapList = config.bootstrapList ?? []
	const listen = config.listen ?? ["/ip4/127.0.0.1/tcp/8080/ws"]
	const announce = config.announce ?? ["/ip4/127.0.0.1/tcp/8080/ws"]

	return await createLibp2p({
		peerId: peerId,
		start: config.start ?? false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],
		connectionGater: {
			denyDialMultiaddr: (addr: Multiaddr) => false,
		},

		connectionManager: {
			minConnections: config.minConnections,
			maxConnections: config.maxConnections,
		},

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [yamux()],
		connectionEncryption: [noise({})],
		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: pingService({ protocolPrefix: "canvas" }),
			fetch: fetchService({ protocolPrefix: "canvas" }),

			dht: kadDHT({ protocol: getTopicDHTProtocol(config.topic) }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictNoSign",
				asyncValidation: true,
				scoreParams: { IPColocationFactorWeight: 0 },
			}),

			discovery: discovery({}),
		},
	})
}
