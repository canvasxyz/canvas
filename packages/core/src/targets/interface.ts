import type { Libp2p } from "libp2p"
import type { PingService } from "@libp2p/ping"
import type { Fetch as FetchService } from "@libp2p/fetch"
import type { PubSub } from "@libp2p/interface"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import type pg from "pg"

import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"
import type { GossipLogService } from "@canvas-js/gossiplog/service"
import type { DiscoveryService } from "@canvas-js/discovery"
import type { SignerCache } from "@canvas-js/interfaces"

import type { NetworkConfig } from "../Canvas.js"

export interface PlatformTarget {
	createLibp2p: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		config: NetworkConfig & { signers: SignerCache },
	) => Promise<Libp2p<ServiceMap>>

	openDB: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		models: ModelsInit,
		options?: { indexHistory?: Record<string, boolean> },
	) => Promise<AbstractModelDB>

	openGossipLog: <Payload>(
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Payload>,
	) => Promise<AbstractGossipLog<Payload>>
}

export type ServiceMap = {
	identify: {}
	ping: PingService
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService
	fetch: FetchService
	discovery: DiscoveryService
}
