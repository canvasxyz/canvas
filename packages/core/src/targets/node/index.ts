import type pg from "pg"

import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/node"

import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"

const isPostgres = (path: string | pg.ConnectionConfig): boolean =>
	typeof path !== "string" || path.startsWith("postgres://") || path.startsWith("postgresql://")

const target: PlatformTarget = {
	async openGossipLog(location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean }, init) {
		if (location.path === null) {
			return new SqliteGossipLog(init)
		} else if (isPostgres(location.path)) {
			return await PostgresGossipLog.open(location.path, { ...init, clear: location.clear })
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			return new SqliteGossipLog({ directory: location.path, ...init })
		}
	},

	createLibp2p: (config) => getLibp2p(config),
}

export default target
