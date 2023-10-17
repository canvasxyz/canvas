import type { Libp2p, Libp2pOptions } from "libp2p"
import type { PingService } from "libp2p/ping"
import type { FetchService } from "libp2p/fetch"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface/pubsub"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { GossipLogService } from "@canvas-js/gossiplog"
import type { DiscoveryService } from "@canvas-js/discovery"
import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"

import type { CanvasConfig } from "../Canvas.js"

export interface PlatformTarget {
	getPeerId: (location: string | null) => Promise<PeerId>

	createLibp2p: (config: CanvasConfig, peerId: PeerId) => Promise<Libp2p<ServiceMap>>

	openDB: (
		location: string | null,
		name: string,
		models: ModelsInit,
		options?: { indexHistory?: Record<string, boolean> }
	) => Promise<AbstractModelDB>

	openGossipLog: <Payload, Result>(
		location: string | null,
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
