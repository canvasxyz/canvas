import type { Libp2p } from "@libp2p/interface"

import type pg from "pg"

import type { Action, Session } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit, NetworkConfig, ServiceMap } from "@canvas-js/gossiplog"

export interface PlatformTarget {
	openGossipLog: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Action | Session>,
	) => Promise<AbstractGossipLog<Action | Session>>

	createLibp2p: (config: NetworkConfig) => Promise<Libp2p<ServiceMap>>
}
