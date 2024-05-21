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

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"
import { Action, Session, SignerCache } from "@canvas-js/interfaces"

import { DIAL_CONCURRENCY, MAX_CONNECTIONS, MIN_CONNECTIONS, PING_TIMEOUT } from "@canvas-js/core/constants"

import type { ServiceMap } from "../interface.js"
import type { NetworkConfig } from "../../Canvas.js"

export function getLibp2pOptions(
	messageLog: AbstractGossipLog<Action | Session>,
	peerId: PeerId,
	options: NetworkConfig & { signers: SignerCache },
): Libp2pOptions<ServiceMap> {
	const announce = options.announce ?? []
	const listen = options.listen ?? []
	const bootstrapList = options.bootstrapList ?? []

	for (const address of announce) {
		console.log(`[canvas] Announcing on ${address}/p2p/${peerId}`)
	}

	for (const address of listen) {
		console.log(`[canvas] Listening on ${address}`)
	}

	return {
		start: options.start ?? true,
		peerId: peerId,
		addresses: { listen, announce },

		connectionManager: {
			minConnections: options.minConnections ?? MIN_CONNECTIONS,
			maxConnections: options.maxConnections ?? MAX_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
		},

		transports: [webSockets({ filter: all })],

		connectionEncryption: [noise()],
		streamMuxers: [yamux({})],
		peerDiscovery: bootstrapList.length === 0 ? [] : [bootstrap({ list: bootstrapList })],

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
