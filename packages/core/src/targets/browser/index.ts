import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser"
import { GossipLog } from "@canvas-js/gossiplog/idb"
import { ModelDB } from "@canvas-js/modeldb-idb"
import { OpfsModelDB } from "@canvas-js/modeldb-sqlite-wasm"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openDB: async ({ path, topic }, models) => {
		if (path) {
			if (typeof path !== "string") throw new Error("Expected path to be a string")
			return OpfsModelDB.initialize({ path, models: { ...models, ...AbstractGossipLog.schema } })
		} else {
			return ModelDB.initialize({ name: `canvas/v1/${topic}`, models: { ...models, ...AbstractGossipLog.schema } })
		}
	},

	openGossipLog: ({}, init) => GossipLog.open(init),

	createLibp2p: (config, messageLog) => getLibp2p(config, messageLog),
}

export default target
