import type { Libp2p } from "@libp2p/interface"

import type pg from "pg"

import type { Action, Session } from "@canvas-js/interfaces"
import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import type { AbstractGossipLog, GossipLogInit, NetworkConfig, ServiceMap } from "@canvas-js/gossiplog"

export type ModelDBPath = string | pg.ConnectionConfig | null

export function isSqlitePath(path: ModelDBPath): path is `sqlite://${string}` {
	return typeof path == "string" && path.startsWith("sqlite://")
}

export function isIndexedDbPath(path: ModelDBPath): path is `indexeddb://${string}` {
	return typeof path == "string" && path.startsWith("indexeddb://")
}

type PostgresPath = `postgres://${string}` | `postgresql://${string}` | pg.ConnectionConfig
export function isPostgresPath(path: ModelDBPath): path is PostgresPath {
	if (typeof path == "string" && (path.startsWith("postgres://") || path.startsWith("postgresql://"))) {
		return true
	}
	if (path != null && typeof path == "object") {
		return true
	}
	return false
}

export interface PlatformTarget {
	openGossipLog: (
		location: { path: ModelDBPath; topic: string; clear?: boolean },
		init: GossipLogInit<Action | Session>,
	) => Promise<AbstractGossipLog<Action | Session>>

	openDB: (
		location: { path: ModelDBPath; topic: string; clear?: boolean },
		models: ModelSchema,
	) => Promise<AbstractModelDB>

	createLibp2p: (
		config: NetworkConfig,
		messageLog: AbstractGossipLog<Action | Session>,
	) => Promise<Libp2p<ServiceMap<Action | Session>>>
}
