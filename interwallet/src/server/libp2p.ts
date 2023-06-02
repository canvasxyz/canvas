import path from "node:path"
import fs from "node:fs"

import { Libp2p, createLibp2p } from "libp2p"
import { circuitRelayTransport } from "libp2p/circuit-relay"
import { identifyService } from "libp2p/identify"
import { pingService, PingService } from "libp2p/ping"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"

import { PubsubServiceDiscovery, pubsubServiceDiscovery } from "@canvas-js/pubsub-service-discovery"
import { protocolPrefix } from "@canvas-js/store"

import { MAX_CONNECTIONS, MIN_CONNECTIONS, PING_TIMEOUT } from "./constants.js"
import { dataDirectory, bootstrapList, listenAddresses, announceAddresses } from "./config.js"

export type ServiceMap = {
	identify: {}
	pubsub: PubSub<GossipsubEvents>
	ping: PingService
}

export async function getLibp2p(peerId: PeerId): Promise<Libp2p<ServiceMap>> {
	console.log("using peerId", peerId.toString())
	console.log("using bootstrap list", bootstrapList)

	return await createLibp2p({
		start: false,
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

		addresses: { listen: listenAddresses, announce: announceAddresses },
		transports: [
			webSockets({ filter: all }),
			circuitRelayTransport({ discoverRelays: announceAddresses.length > 0 ? 0 : bootstrapList.length }),
		],

		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		connectionManager: {
			minConnections: MIN_CONNECTIONS,
			maxConnections: MAX_CONNECTIONS,
		},

		metrics: prometheusMetrics({}),

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
}

const peerIdPath = path.resolve(dataDirectory, "peer.id")

const { PEER_ID } = process.env

export async function getPeerId(): Promise<PeerId> {
	if (typeof PEER_ID === "string") {
		const peerIdBytes = Buffer.from(PEER_ID, "base64")
		return await createFromProtobuf(peerIdBytes)
	} else if (fs.existsSync(peerIdPath)) {
		const peerIdBytes = Buffer.from(fs.readFileSync(peerIdPath, "utf-8"), "base64")
		return await createFromProtobuf(peerIdBytes)
	} else {
		const peerId = await createEd25519PeerId()
		const peerIdBytes = Buffer.from(exportToProtobuf(peerId))
		fs.writeFileSync(peerIdPath, peerIdBytes.toString("base64"), "utf-8")
		return peerId
	}
}
