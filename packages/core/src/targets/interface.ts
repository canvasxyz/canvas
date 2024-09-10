import type { Libp2p } from "@libp2p/interface"

import type pg from "pg"

import type { Action, Awaitable, Session } from "@canvas-js/interfaces"
import type { AbstractGossipLog, GossipLogInit, NetworkConfig } from "@canvas-js/gossiplog"

export interface PlatformTarget {
	openGossipLog: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Action | Session>,
	) => Promise<AbstractGossipLog<Action | Session>>

	attachNetwork: (gossipLog: AbstractGossipLog<Action | Session>, config: NetworkConfig) => Awaitable<void>

	// createLibp2p: (config: NetworkConfig) => Promise<Libp2p<ServiceMap>>
}
