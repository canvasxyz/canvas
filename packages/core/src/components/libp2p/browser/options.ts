import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { ethers } from "ethers"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { assert } from "@canvas-js/core/utils"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MIN_CONNECTIONS,
	MAX_CONNECTIONS,
	PEER_ID_FILENAME,
	PEER_DISCOVERY_REFRESH_INTERVAL,
	PEER_DISCOVERY_TOPIC,
	PING_TIMEOUT,
} from "@canvas-js/core/constants"

import type { P2PConfig } from "../types.js"

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList
	assert(bootstrapList.length > 0, "bootstrap list cannot be empty")

	const options: Libp2pOptions = {
		peerId: peerId,
		addresses: { listen: [], announce: [] },

		connectionManager: {
			minConnections: config.minConnections ?? MIN_CONNECTIONS,
			maxConnections: config.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
			maxParallelDialsPerPeer: DIAL_CONCURRENCY_PER_PEER,
		},

		transports: [webSockets(), circuitRelayTransport({ discoverRelays: bootstrapList.length })],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [
			bootstrap({ list: bootstrapList }),
			pubsubPeerDiscovery({ interval: PEER_DISCOVERY_REFRESH_INTERVAL, topics: [PEER_DISCOVERY_TOPIC] }),
		],

		identify: {
			protocolPrefix: "canvas",
		},

		pubsub: gossipsub({
			emitSelf: false,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
		}),

		ping: {
			protocolPrefix: "canvas",
			maxInboundStreams: 32,
			maxOutboundStreams: 32,
			timeout: PING_TIMEOUT,
		},
	}

	return options
}

export async function getPeerId(directory: string | null): Promise<PeerId> {
	assert(directory !== null)

	const localStorageKey = `canvas:${directory}/${PEER_ID_FILENAME}`
	const item = localStorage.getItem(localStorageKey)
	if (item === null) {
		const peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId)
		localStorage.setItem(localStorageKey, ethers.utils.base64.encode(privateKey))
		console.log(`[canvas-core] [p2p] Created new peer id ${peerId}`)
		return peerId
	} else {
		const peerId = await createFromProtobuf(ethers.utils.base64.decode(item))
		console.log(`[canvas-core] [p2p] Found existing peer id ${peerId}`)
		return peerId
	}
}
