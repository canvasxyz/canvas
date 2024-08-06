import path from "node:path"
import type pg from "pg"

import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/node"

import { ModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"

const isPostgres = (path: string | pg.ConnectionConfig): boolean =>
	typeof path !== "string" || path.startsWith("postgres://") || path.startsWith("postgresql://")

const target: PlatformTarget = {
	async openDB(location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean }, models) {
		if (location.path === null) {
			return new ModelDB({ path: null, models })
		} else if (isPostgres(location.path)) {
			return await PostgresModelDB.initialize({ connectionConfig: location.path, models, clear: location.clear })
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			// TODO: delete db.sqlite
			return new ModelDB({ path: path.resolve(location.path, "db.sqlite"), models })
		}
	},

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

	createLibp2p: (config, topic) => getLibp2p(config, topic),
}

export default target
