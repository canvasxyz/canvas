import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface"
import { ping as pingService } from "@libp2p/ping"
import { identify as identifyService } from "@libp2p/identify"
import { fetch as fetchService } from "@libp2p/fetch"
// import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"

import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { GossipLogService, gossiplog } from "@canvas-js/gossiplog/service"
import { discovery } from "@canvas-js/discovery"
import { Action, Session, SignerCache } from "@canvas-js/interfaces"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { DIAL_CONCURRENCY, MAX_CONNECTIONS, MIN_CONNECTIONS, PING_TIMEOUT } from "@canvas-js/core/constants"

import type { ServiceMap } from "../interface.js"
import type { NetworkConfig } from "../../Canvas.js"
import { AbstractGossipLog } from "@canvas-js/gossiplog"

export function getLibp2pOptions(
	messageLog: AbstractGossipLog<Action | Session>,
	peerId: PeerId,
	options: NetworkConfig & { signers: SignerCache },
): Libp2pOptions<ServiceMap> {
	const announce = options.announce ?? []
	const listen = options.listen ?? []
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
		start: !options.offline,
		peerId: peerId,
		addresses: { listen, announce },

		connectionGater: { denyDialMultiaddr },
		connectionManager: {
			minConnections: options.minConnections ?? MIN_CONNECTIONS,
			maxConnections: options.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
		},

		transports: [webSockets({ filter: all })],

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
				runOnTransientConnection: false,
			}),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroPeers: true,
				globalSignaturePolicy: "StrictNoSign",
				scoreParams: {
					behaviourPenaltyWeight: -1.0, // 1/10th of default
					retainScore: 10 * 1000, // 10 seconds, instead of 1 hour
				},
				scoreThresholds: {
					gossipThreshold: -999_999_999, // default is -10
					publishThreshold: -999_999_999, // default is -50
					graylistThreshold: -999_999_999, // default is -80
				},
			}),

			gossiplog: gossiplog(messageLog, {}),
			fetch: fetchService({ protocolPrefix: "canvas" }),
			// discovery: discovery({
			// 	discoveryTopic: options.discoveryTopic,
			// 	discoveryInterval: options.discoveryInterval,
			// 	trackAllPeers: options.trackAllPeers,
			// 	evictionThreshold: options.presenceTimeout,
			// 	topicFilter: (topic) => topic.startsWith(GossipLogService.topicPrefix),
			// 	addressFilter: (addr) => WebSockets.matches(addr) || WebSocketsSecure.matches(addr),
			// 	signers: options.signers,
			// 	appTopic,
			// }),
		},
	}
}
