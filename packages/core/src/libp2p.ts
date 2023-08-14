import chalk from "chalk"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface-pubsub"
import { pingService, PingService } from "libp2p/ping"
import { identifyService } from "libp2p/identify"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { assert } from "@canvas-js/core/utils"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
} from "@canvas-js/core/constants"

import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

export interface P2PConfig {
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export type ServiceMap = {
	pubsub: PubSub<GossipsubEvents>
	pingService: PingService
	identifyService: {}
}

export function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Libp2pOptions<ServiceMap> {
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
			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroPeers: true,
				globalSignaturePolicy: "StrictSign",
			}),

			identifyService: identifyService({
				protocolPrefix: "canvas",
			}),

			pingService: pingService({
				protocolPrefix: "canvas",
				maxInboundStreams: 32,
				maxOutboundStreams: 32,
				timeout: PING_TIMEOUT,
			}),
		},
	}
}
