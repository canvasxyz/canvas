import chalk from "chalk"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface"
import { ping as pingService } from "@libp2p/ping"
import { identify as identifyService } from "@libp2p/identify"
import { fetch as fetchService } from "@libp2p/fetch"
import { kadDHT } from "@libp2p/kad-dht"

import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"

import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { register } from "prom-client"

import type { Action, Session } from "@canvas-js/interfaces"
import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import { DIAL_CONCURRENCY, MAX_CONNECTIONS, MIN_CONNECTIONS, PING_TIMEOUT } from "@canvas-js/core/constants"

import type { ServiceMap } from "../interface.js"
import { NetworkConfig } from "../../Canvas.js"

export function getLibp2pOptions(
	messageLog: AbstractGossipLog<Action | Session>,
	peerId: PeerId,
	config: NetworkConfig,
): Libp2pOptions<ServiceMap> {
	const announce = config.announce ?? []
	const listen = config.listen ?? []
	const bootstrapList = config.bootstrapList ?? []

	for (const address of announce) {
		console.log(chalk.gray(`[canvas] Announcing on ${address}/p2p/${peerId}`))
	}

	for (const address of listen) {
		console.log(chalk.gray(`[canvas] Listening on ${address}`))
	}

	return {
		start: config.start ?? true,
		peerId: peerId,
		addresses: { listen, announce },

		connectionManager: {
			minConnections: config.minConnections ?? MIN_CONNECTIONS,
			maxConnections: config.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
		},

		transports: [webSockets({ filter: all })],

		connectionEncryption: [noise()],
		streamMuxers: [yamux({})],
		peerDiscovery: bootstrapList.length === 0 ? [] : [bootstrap({ list: bootstrapList })],

		metrics: prometheusMetrics({ registry: register }),

		services: {
			identify: identifyService({ protocolPrefix: "canvas" }),

			dht: kadDHT({ protocol: `/canvas/${messageLog.topic}/kad/1.0.0` }),

			ping: pingService({
				protocolPrefix: "canvas",
				maxInboundStreams: 32,
				maxOutboundStreams: 32,
				timeout: PING_TIMEOUT,
				runOnTransientConnection: false,
			}),

			fetch: fetchService({ protocolPrefix: "canvas" }),

			pubsub: gossipsub({
				globalSignaturePolicy: "StrictSign",
				asyncValidation: true,
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
			}),

			gossiplog: gossiplog(messageLog, {}),
		},
	}
}
