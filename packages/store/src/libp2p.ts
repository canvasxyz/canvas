import chalk from "chalk"

import { Libp2pOptions } from "libp2p"
import { circuitRelayTransport } from "libp2p/circuit-relay"
import { identifyService } from "libp2p/identify"
import { pingService, PingService } from "libp2p/ping"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { ServiceDiscovery, pubsubServiceDiscovery } from "@canvas-js/pubsub-service-discovery"

import { NetworkConfig } from "./network.js"
import { defaultBootstrapList } from "./bootstrap.js"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
} from "./constants.js"
import { assert } from "./utils.js"

export type ServiceMap = {
	pubsub: PubSub<GossipsubEvents>
	identify: {}
	ping: PingService
	serviceDiscovery: ServiceDiscovery
}

export function getLibp2pOptions(peerId: PeerId, config: NetworkConfig): Libp2pOptions<ServiceMap> {
	const announce = config.announce ?? []
	const listen = config.listen ?? []
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList
	assert(bootstrapList.length > 0, "bootstrap list cannot be empty")

	if (listen.length === 0) {
		console.log(chalk.yellowBright(`[canvas] Using bootstrap servers as relays.`))
	}

	for (const address of announce) {
		console.log(chalk.gray(`[canvas] Announcing on ${address}`))
	}

	for (const address of listen) {
		console.log(chalk.gray(`[canvas] Listening on ${address}`))
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

			identify: identifyService({
				protocolPrefix: "canvas",
			}),

			ping: pingService({
				protocolPrefix: "canvas",
				maxInboundStreams: 32,
				maxOutboundStreams: 32,
				timeout: PING_TIMEOUT,
			}),

			serviceDiscovery: pubsubServiceDiscovery({}),
		},
	}
}
