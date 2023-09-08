import chalk from "chalk"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface/peer-id"
import type { PubSub } from "@libp2p/interface/pubsub"
import { pingService, PingService } from "libp2p/ping"
import { identifyService } from "libp2p/identify"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { GossipLog, gossiplog } from "@canvas-js/gossiplog"
// import { discovery, DiscoveryService } from "@canvas-js/discovery"

import { defaultBootstrapList } from "./bootstrap.js"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
} from "./constants.js"

export interface P2PConfig {
	offline?: boolean
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export type ServiceMap = {
	identifyService: {}
	pingService: PingService
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLog
	// discovery: DiscoveryService
}

export function getLibp2pOptions(
	location: string | null,
	peerId: PeerId,
	config: P2PConfig
): Libp2pOptions<ServiceMap> {
	const offline = config.offline ?? false
	const announce = config.announce ?? []
	const listen = config.listen ?? []
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	if (listen.length === 0 && !offline) {
		console.log(chalk.yellowBright(`[canvas-core] Using Canvas bootstrap servers as relays.`))
	}

	for (const address of announce) {
		console.log(chalk.gray(`[canvas-core] Announcing on ${address}`))
	}

	for (const address of listen) {
		console.log(chalk.gray(`[canvas-core] Listening on ${address}`))
	}

	const bootstrapPeerIds = new Set()
	for (const bootstrapPeer of bootstrapList) {
		const id = multiaddr(bootstrapPeer).getPeerId()
		if (id !== null) {
			bootstrapPeerIds.add(id)
		}
	}

	function denyDialMultiaddr(addr: Multiaddr): boolean {
		const id = addr.getPeerId()
		if (!bootstrapPeerIds.has(id)) {
			return false
		}

		const relayRoot = addr.decapsulateCode(290) // /p2p-circuit
		const relayRootId = relayRoot.getPeerId()

		return relayRootId !== id && bootstrapPeerIds.has(relayRootId)
	}

	return {
		start: false,
		peerId: peerId,
		addresses: { listen, announce },

		connectionGater: { denyDialMultiaddr },
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
		peerDiscovery: [bootstrap({ list: bootstrapList })],

		services: {
			identifyService: identifyService({ protocolPrefix: "canvas" }),

			pingService: pingService({
				protocolPrefix: "canvas",
				maxInboundStreams: 32,
				maxOutboundStreams: 32,
				timeout: PING_TIMEOUT,
			}),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroPeers: true,
				globalSignaturePolicy: "StrictNoSign",
			}),

			gossiplog: gossiplog({ location: location && `${location}/messages` }),

			// discovery: discovery({}),
		},
	}
}
