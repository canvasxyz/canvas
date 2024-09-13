import type pg from "pg"
import type http from "node:http"

import type { Action, Session } from "@canvas-js/interfaces"
import type { AbstractGossipLog, GossipLogInit, NetworkConfig, ServiceMap } from "@canvas-js/gossiplog"
import { Libp2p } from "@libp2p/interface"

export interface PlatformTarget {
	openGossipLog: (
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Action | Session>,
	) => Promise<AbstractGossipLog<Action | Session>>

	connect: (gossipLog: AbstractGossipLog<Action | Session>, target: string, signal: AbortSignal) => Promise<void>

	listen: (
		gossipLog: AbstractGossipLog<Action | Session>,
		handle: number | NetworkConfig,
		signal: AbortSignal,
	) => Promise<void>
}
