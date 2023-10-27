import type { Libp2p, Libp2pOptions } from "libp2p"
import type { PingService } from "libp2p/ping"
import type { FetchService } from "libp2p/fetch"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface/pubsub"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { GossipLogService } from "@canvas-js/gossiplog/service"
import type { DiscoveryService } from "@canvas-js/discovery"
import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"

export interface PlatformTarget {
	getPeerId: (config: { path: string | null; topic: string }) => Promise<PeerId>

	createLibp2p: (
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
	) => Promise<Libp2p<ServiceMap>>

	openDB: (
		config: { path: string | null; topic: string },
		models: ModelsInit,
		options?: { indexHistory?: Record<string, boolean> }
	) => Promise<AbstractModelDB>

	openGossipLog: <Payload, Result>(
		config: { path: string | null; topic: string },
		init: GossipLogInit<Payload, Result>
	) => Promise<AbstractGossipLog<Payload, Result>>
}

export type ServiceMap = {
	identifyService: {}
	pingService: PingService
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService
	fetch: FetchService
	discovery: DiscoveryService
}
