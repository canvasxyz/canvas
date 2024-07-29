import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser"
import { GossipLog as SqliteWasmGossipLog } from "@canvas-js/gossiplog/sqlite-wasm"
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"
import { ModelDB as IdbModelDB } from "@canvas-js/modeldb-idb"
import { ModelDB as SqliteWasmModelDB } from "@canvas-js/modeldb-sqlite-wasm"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openDB: async ({ path, topic }, models) => {
		if (path) {
			if (typeof path !== "string") throw new Error("Expected path to be a string")
			return SqliteWasmModelDB.initialize({ path, models: { ...models, ...AbstractGossipLog.schema } })
		} else {
			return IdbModelDB.initialize({ name: `canvas/v1/${topic}`, models: { ...models, ...AbstractGossipLog.schema } })
		}
	},

	openGossipLog: ({ path }, init) => {
		if (path) {
			if (typeof path !== "string") throw new Error("Expected path to be a string")
			return SqliteWasmGossipLog.open(init)
		} else {
			return IdbGossipLog.open(init)
		}
	},

	createLibp2p: (config, messageLog) => getLibp2p(config, messageLog),
}

export default target
