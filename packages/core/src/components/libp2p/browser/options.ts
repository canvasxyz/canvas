import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex as hex } from "@noble/hashes/utils"
import { ethers } from "ethers"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { assert } from "@canvas-js/core/utils"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MIN_CONNECTIONS,
	PEER_ID_FILENAME,
	minute,
	second,
} from "@canvas-js/core/constants"

import type { P2PConfig } from "../types.js"

const { base64 } = ethers.utils

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	const options: Libp2pOptions = {
		peerId: peerId,
		addresses: { listen: [], announce: [] },

		connectionManager: {
			minConnections: MIN_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
			maxParallelDialsPerPeer: DIAL_CONCURRENCY_PER_PEER,
		},

		transports: [webSockets(), circuitRelayTransport({ discoverRelays: bootstrapList.length })],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],
	}

	if (config.disablePubSub) {
		console.log(`[canvas-core] [p2p] Disabling PubSub`)
	} else {
		options.pubsub = gossipsub({
			emitSelf: false,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
			msgIdFn: (msg) => sha256(msg.data),
			msgIdToStrFn: (id) => hex(id),
		})
	}

	if (config.disablePing) {
		console.log(`[canvas-core] [p2p] Disabling ping`)
	} else {
		options.ping = {
			protocolPrefix: "canvas",
			maxInboundStreams: 32,
			maxOutboundStreams: 32,
			timeout: 20 * second,
		}
	}

	if (config.disableDHT) {
		console.log(`[canvas-core] [p2p] Disabling DHT`)
	} else {
		options.dht = kadDHT({
			protocolPrefix: "/canvas",
			clientMode: true,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		})
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
		localStorage.setItem(localStorageKey, base64.encode(privateKey))
		console.log(`[canvas-core] [p2p] Created new peer id ${peerId}`)
		return peerId
	} else {
		const peerId = await createFromProtobuf(base64.decode(item))
		console.log(`[canvas-core] [p2p] Found existing peer id ${peerId}`)
		return peerId
	}
}
