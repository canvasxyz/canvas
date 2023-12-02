import type { Libp2p } from "libp2p"
import type { PingService } from "libp2p/ping"
import type { FetchService } from "libp2p/fetch"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface/pubsub"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"
import type { GossipLogService } from "@canvas-js/gossiplog/service"
import type { DiscoveryService } from "@canvas-js/discovery"

import type { NetworkConfig } from "../Canvas.js"

export interface PlatformTarget {
	createLibp2p: (location: { path: string | null; topic: string }, config: NetworkConfig) => Promise<Libp2p<ServiceMap>>

	openDB: (
		location: { path: string | null; topic: string },
		models: ModelsInit,
		options?: { indexHistory?: Record<string, boolean> },
	) => Promise<AbstractModelDB>

	openGossipLog: <Payload, Result>(
		location: { path: string | null; topic: string },
		init: GossipLogInit<Payload, Result>,
	) => Promise<AbstractGossipLog<Payload, Result>>
}

export type ServiceMap = {
	identify: {}
	ping: PingService
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService
	fetch: FetchService
	discovery: DiscoveryService
}
