import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser"
import { GossipLog } from "@canvas-js/gossiplog/idb"
import { ModelDB } from "@canvas-js/modeldb-idb"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openDB: ({ topic }, models) =>
		ModelDB.initialize({ name: `canvas/${topic}`, models: { ...models, ...AbstractGossipLog.schema } }),

	openGossipLog: ({}, init) => GossipLog.open(init),

	createLibp2p: (config, messageLog) => getLibp2p(config, messageLog),
}

export default target
