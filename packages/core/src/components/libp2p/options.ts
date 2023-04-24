import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery"
import { kadDHT } from "@libp2p/kad-dht"

import type { P2PConfig } from "./types.js"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { assert } from "@canvas-js/core/utils"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
	PUBSUB_DISCOVERY_REFRESH_INTERVAL,
	PUBSUB_DISCOVERY_TOPIC,
	minute,
} from "@canvas-js/core/constants"
import chalk from "chalk"

export function getBaseLibp2pOptions(peerId: PeerId, config: P2PConfig): Libp2pOptions {
	const announce = config.announce ?? []
	const listen = config.listen ?? []
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList
	assert(bootstrapList.length > 0, "bootstrap list cannot be empty")

	if (listen.length === 0) {
		console.log(chalk.yellowBright(`[canvas-core] Using Canvas bootstrap servers as relays.`))
	}

	for (const address of announce) {
		console.log(chalk.gray(`[canvas-core] Announcing on ${address}`))
	}

	for (const address of listen) {
		console.log(chalk.gray(`[canvas-core] Listening on ${address}`))
	}

	return {
		peerId: peerId,
		addresses: { listen, announce },

		connectionGater: {},
		connectionManager: {
			minConnections: config.minConnections ?? MIN_CONNECTIONS,
			maxConnections: config.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
			maxParallelDialsPerPeer: DIAL_CONCURRENCY_PER_PEER,
		},

		transports: [
			webSockets(),
			circuitRelayTransport({ discoverRelays: announce.length === 0 ? bootstrapList.length : 0 }),
		],

		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [
			bootstrap({ list: bootstrapList }),
			pubsubPeerDiscovery({ interval: PUBSUB_DISCOVERY_REFRESH_INTERVAL, topics: [PUBSUB_DISCOVERY_TOPIC] }),
		],

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
}
