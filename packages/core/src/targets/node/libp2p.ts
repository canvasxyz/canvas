import chalk from "chalk"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface"
import { ping as pingService } from "@libp2p/ping"
import { fetch as fetchService } from "@libp2p/fetch"
import { identify as identifyService } from "@libp2p/identify"

import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { register } from "prom-client"

import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { GossipLogService, gossiplog } from "@canvas-js/gossiplog/service"
import { discovery } from "@canvas-js/discovery"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import { DIAL_CONCURRENCY, MAX_CONNECTIONS, MIN_CONNECTIONS, PING_TIMEOUT } from "@canvas-js/core/constants"

import type { ServiceMap } from "../interface.js"
import { NetworkConfig } from "../../Canvas.js"

export function getLibp2pOptions(peerId: PeerId, options: NetworkConfig): Libp2pOptions<ServiceMap> {
	const announce = options.announce ?? []
	const listen = options.listen ?? []
	const bootstrapList = options.bootstrapList ?? defaultBootstrapList

	for (const address of announce) {
		console.log(chalk.gray(`[canvas] Announcing on ${address}/p2p/${peerId}`))
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
		streamMuxers: [mplex()],
		peerDiscovery: bootstrapList.length === 0 ? [] : [bootstrap({ list: bootstrapList })],

		metrics: prometheusMetrics({ registry: register }),

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

			gossiplog: gossiplog({ sync: true }),

			fetch: fetchService({ protocolPrefix: "canvas" }),
			discovery: discovery({
				discoveryTopic: options.discoveryTopic,
				topicFilter: (topic) => topic.startsWith(GossipLogService.topicPrefix),
				addressFilter: (addr) => WebSockets.matches(addr) || WebSocketsSecure.matches(addr),
			}),
		},
	}
}
