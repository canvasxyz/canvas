import type { Libp2p } from "libp2p"
import type { PingService } from "@libp2p/ping"
import type { Fetch as FetchService } from "@libp2p/fetch"
import type { PubSub } from "@libp2p/interface"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { KadDHT } from "@libp2p/kad-dht"

import type pg from "pg"

import type { Action, Session, SignerCache } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit } from "@canvas-js/gossiplog"
import type { GossipLogService } from "@canvas-js/gossiplog/service"

import type { NetworkConfig } from "../Canvas.js"

export interface PlatformTarget {
	openGossipLog: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Action | Session>,
	) => Promise<AbstractGossipLog<Action | Session>>

	openDB: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		models: ModelsInit,
	) => Promise<AbstractModelDB>

	createLibp2p: (
		messageLog: AbstractGossipLog<Action | Session>,
		config: NetworkConfig & { signers: SignerCache },
	) => Promise<Libp2p<ServiceMap>>
}

export type ServiceMap = {
	identify: {}
	dht: KadDHT
	ping: PingService
	fetch: FetchService
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService<Action | Session>
}
