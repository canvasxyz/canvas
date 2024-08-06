import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser"
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	createLibp2p: (config) => getLibp2p(config),
}

export default target
