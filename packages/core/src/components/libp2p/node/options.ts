import path from "node:path"
import fs from "node:fs"

import chalk from "chalk"

import { register } from "prom-client"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { kadDHT } from "@libp2p/kad-dht"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { assert } from "@canvas-js/core/utils"
import {
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	PUBSUB_DISCOVERY_TOPIC,
	PEER_ID_FILENAME,
	PUBSUB_DISCOVERY_REFRESH_INTERVAL,
	PING_TIMEOUT,
	minute,
} from "@canvas-js/core/constants"

import type { P2PConfig } from "../types.js"

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList
	assert(bootstrapList.length > 0, "bootstrap list cannot be empty")

	if (config.listen === undefined) {
		console.log(
			chalk.yellowBright(`[canvas-core] [p2p] No --listen address provided. Using bootstrap servers as relays.`)
		)
	}

	const announce = config.announce ?? []
	for (const address of announce) {
		console.log(chalk.gray(`[canvas-core] [p2p] Announcing on ${address}`))
	}

	const listen = config.listen ?? []
	for (const address of listen) {
		console.log(chalk.gray(`[canvas-core] [p2p] Listening on ${address}`))
	}

	const options: Libp2pOptions = {
		peerId: peerId,
		addresses: { listen, announce },

		connectionManager: {
			minConnections: config.minConnections ?? MIN_CONNECTIONS,
			maxConnections: config.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
			maxParallelDialsPerPeer: DIAL_CONCURRENCY_PER_PEER,
		},

		transports: [webSockets(), circuitRelayTransport({ discoverRelays: announce.length === 0 ? 1 : 0 })],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [
			bootstrap({ list: bootstrapList }),
			pubsubPeerDiscovery({ interval: PUBSUB_DISCOVERY_REFRESH_INTERVAL, topics: [PUBSUB_DISCOVERY_TOPIC] }),
		],

		metrics: prometheusMetrics({ registry: register }),

		dht: kadDHT({
			protocolPrefix: "/canvas",
			clientMode: announce.length === 0,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		}),

		pubsub: gossipsub({
			emitSelf: false,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
		}),

		identify: {
			protocolPrefix: "canvas",
		},

		fetch: {
			protocolPrefix: "canvas",
		},

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
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	if (directory === null) {
		const peerId = await createEd25519PeerId()
		console.log(`[canvas-core] [p2p] Using temporary PeerId ${peerId}`)
		return peerId
	}

	const peerIdPath = path.resolve(directory, PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		const peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
		return peerId
	} else {
		console.log(`[canvas-core] [p2p] Creating new PeerID at ${peerIdPath}`)
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		return peerId
	}
}
