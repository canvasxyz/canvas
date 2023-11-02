import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface/peer-id"
import { pingService } from "libp2p/ping"
import { identifyService } from "libp2p/identify"
import { fetchService } from "libp2p/fetch"
import { circuitRelayTransport } from "libp2p/circuit-relay"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { webRTC } from "@libp2p/webrtc"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { gossiplog } from "@canvas-js/gossiplog/service"
import { discovery } from "@canvas-js/discovery"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MAX_CONNECTIONS,
	MIN_CONNECTIONS,
	PING_TIMEOUT,
} from "@canvas-js/core/constants"

import type { ServiceMap } from "../interface.js"

export function getLibp2pOptions(
	peerId: PeerId,
	options: {
		offline?: boolean
		start?: boolean
		listen?: string[]
		announce?: string[]
		bootstrapList?: string[]
		minConnections?: number
		maxConnections?: number
	}
): Libp2pOptions<ServiceMap> {
	const announce = options.announce ?? []
	const listen = options.listen ?? ["/webrtc"]
	const bootstrapList = options.bootstrapList ?? defaultBootstrapList

	for (const address of announce) {
		console.log(`[canvas] Announcing on ${address}/p2p/${peerId}`)
	}

	for (const address of listen) {
		console.log(`[canvas] Listening on ${address}`)
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
			minConnections: options.minConnections ?? MIN_CONNECTIONS,
			maxConnections: options.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
			maxParallelDialsPerPeer: DIAL_CONCURRENCY_PER_PEER,
		},

		transports: [
			webSockets({ filter: all }),
			webRTC({}),
			circuitRelayTransport({ discoverRelays: announce.length === 0 ? bootstrapList.length : 0 }),
		],

		connectionEncryption: [noise()],
		streamMuxers: [mplex({ disconnectThreshold: 20 })],
		peerDiscovery: bootstrapList.length === 0 ? [] : [bootstrap({ list: bootstrapList })],

		services: {
			identify: identifyService({ protocolPrefix: "canvas" }),

			ping: pingService({
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
