import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser-lite"
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"
import { ModelDB as IdbModelDB } from "@canvas-js/modeldb-idb"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openDB: async ({ topic }, models) => {
		return IdbModelDB.initialize({
			name: `canvas/v1/${topic}`,
			models: { ...models, ...AbstractGossipLog.schema },
		})
	},

	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	createLibp2p: (config, messageLog) => getLibp2p(config, messageLog),
}

export default target
