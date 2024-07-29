import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser"
import { GossipLog as SqliteWasmGossipLog } from "@canvas-js/gossiplog/sqlite-wasm"
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"
import { ModelDB as IdbModelDB } from "@canvas-js/modeldb-idb"
import { ModelDB as SqliteWasmModelDB } from "@canvas-js/modeldb-sqlite-wasm"

import { isIndexedDbPath, isPostgresPath, isSqlitePath, type PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openDB: async ({ path, topic }, models) => {
		if (path == null) {
			return SqliteWasmModelDB.initialize({ models })
		} else if (isSqlitePath(path)) {
			const innerPath = path.split("sqlite://")[1]
			return SqliteWasmModelDB.initialize({ path: innerPath, models })
		} else if (isIndexedDbPath(path)) {
			return IdbModelDB.initialize({ name: `canvas/v1/${topic}`, models: { ...models, ...AbstractGossipLog.schema } })
		} else if (isPostgresPath(path)) {
			throw new Error("Postgres not supported in browser")
		} else {
			throw new Error(`Invalid path: ${path}`)
		}
	},

	openGossipLog: ({ path }, init) => {
		if (path == null || isSqlitePath(path)) {
			return SqliteWasmGossipLog.open(init)
		} else if (isIndexedDbPath(path)) {
			return IdbGossipLog.open(init)
		} else if (isPostgresPath(path)) {
			throw new Error("Postgres not supported in browser")
		} else {
			throw new Error(`Invalid path: ${path}`)
		}
	},

	createLibp2p: (config, messageLog) => getLibp2p(config, messageLog),
}

export default target
