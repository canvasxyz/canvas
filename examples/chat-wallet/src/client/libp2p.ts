import { Libp2p, createLibp2p } from "libp2p"
import { circuitRelayTransport } from "libp2p/circuit-relay"
import { identifyService } from "libp2p/identify"
import { pingService, PingService } from "libp2p/ping"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"

import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { PubsubServiceDiscovery, pubsubServiceDiscovery } from "@canvas-js/pubsub-service-discovery"
import { protocolPrefix } from "@canvas-js/store"

import { MAX_CONNECTIONS, MIN_CONNECTIONS, PING_TIMEOUT, PEER_ID_KEY } from "./constants.js"

// @ts-ignore
const BOOTSTRAP_LIST = import.meta.env.VITE_BOOTSTRAP_LIST
const bootstrapList = BOOTSTRAP_LIST?.split(" ") ?? []
console.log("using bootstrap list", bootstrapList)

async function getPeerId(): Promise<PeerId> {
	const entry = window.localStorage.getItem(PEER_ID_KEY)
	if (entry === null) {
		const peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId)
		window.localStorage.setItem(PEER_ID_KEY, base64.baseEncode(privateKey))
		console.log("created new peerId", peerId.toString())
		return peerId
	} else {
		const privateKey = base64.baseDecode(entry)
		const peerId = await createFromProtobuf(privateKey)
		console.log("found existing peerId", peerId.toString())
		return peerId
	}
}

const peerId = await getPeerId()

export type ServiceMap = {
	identify: {}
	pubsub: PubSub<GossipsubEvents>
	ping: PingService
}

export const libp2p: Libp2p<ServiceMap> = await createLibp2p({
	// start: false,
	peerId: peerId,

	// addresses: {
	// 	listen: ["/webrtc"],
	// 	announce: bootstrapList.map((address) => `${address}/p2p-circuit/webrtc/p2p/${peerId}`),
	// },

	// transports: [
	// 	webRTC(),
	// 	webSockets({ filter: all }),
	// 	circuitRelayTransport({ discoverRelays: bootstrapList.length }),
	// ],

	addresses: { listen: [], announce: [] },
	transports: [webSockets({ filter: all }), circuitRelayTransport({ discoverRelays: bootstrapList.length })],

	connectionEncryption: [noise()],
	streamMuxers: [mplex()],
	peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

	connectionManager: {
		minConnections: MIN_CONNECTIONS,
		maxConnections: MAX_CONNECTIONS,
	},

	connectionGater: {
		denyDialMultiaddr: () => {
			return false
		},
	},

	services: {
		pubsub: gossipsub({
			emitSelf: false,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
		}),

		identify: identifyService({
			protocolPrefix: "canvas",
		}),

		ping: pingService({
			protocolPrefix: "canvas",
			maxInboundStreams: 32,
			maxOutboundStreams: 32,
			timeout: PING_TIMEOUT,
		}),

		serviceDiscovery: pubsubServiceDiscovery({
			filterProtocols: (protocol) =>
				protocol === PubsubServiceDiscovery.DISCOVERY_TOPIC || protocol.startsWith(protocolPrefix),
		}),
	},
})

declare global {
	interface Window {
		libp2p: undefined | Libp2p<ServiceMap>
	}
}

window.libp2p = libp2p
