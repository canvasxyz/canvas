import chalk from "chalk"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface/peer-id"
import { pingService } from "libp2p/ping"
import { identifyService } from "libp2p/identify"
import { fetchService } from "libp2p/fetch"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { gossiplog } from "@canvas-js/gossiplog"
import { discovery } from "@canvas-js/discovery"

import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
} from "../../constants.js"
import { CanvasConfig } from "../../Canvas.js"

import type { ServiceMap } from "../interface.js"

export function getLibp2pOptions(config: CanvasConfig, peerId: PeerId): Libp2pOptions<ServiceMap> {
	const announce = config.announce ?? []
	const listen = config.listen ?? ["/webrtc"]
	const bootstrapList = config.bootstrapList ?? []

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
		return false
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

		transports: [webSockets({ filter: all })],

		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: bootstrapList.length === 0 ? [] : [bootstrap({ list: bootstrapList })],

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

			gossiplog: gossiplog({}),
			fetch: fetchService({ protocolPrefix: "canvas" }),
			discovery: discovery({}),
		},
	}
}
