import nodePath from "node:path"

import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/node"
import { ModelDB as SqliteModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { assert } from "@canvas-js/utils"

import { isIndexedDbPath, isSqlitePath, isPostgresPath, type PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openDB({ path, clear }, models) {
		if (path === null) {
			return new SqliteModelDB({ path: null, models })
		} else if (isIndexedDbPath(path)) {
			throw new Error("IndexedDB not supported in node")
		} else if (isPostgresPath(path)) {
			return await PostgresModelDB.initialize({ connectionConfig: path, models, clear: clear })
		} else if (isSqlitePath(path)) {
			assert(typeof path === "string", 'expected typeof location.path === "string"')
			// TODO: delete db.sqlite
			return new SqliteModelDB({ path: nodePath.resolve(path, "db.sqlite"), models })
		} else {
			throw new Error(`Invalid path: ${path}`)
		}
	},

	async openGossipLog({ path, clear }, init) {
		if (path === null) {
			return new SqliteGossipLog(init)
		} else if (isIndexedDbPath(path)) {
			throw new Error("IndexedDB not supported in node")
		} else if (isPostgresPath(path)) {
			return await PostgresGossipLog.open(path, { ...init, clear: clear })
		} else if (isSqlitePath(path)) {
			assert(typeof path === "string", 'expected typeof location.path === "string"')
			// TODO: delete topics/
			assert(typeof path === "string", 'expected typeof location.path === "string"')
			return new SqliteGossipLog({
				directory: nodePath.resolve(path, "topics", init.topic),
				...init,
			})
		} else {
			throw new Error(`Invalid path: ${path}`)
		}
	},

	createLibp2p: (config, messageLog) => getLibp2p(config, messageLog),
}

export default target
