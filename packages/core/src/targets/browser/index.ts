import { NetworkClient } from "@canvas-js/gossiplog/network/client"
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	attachNetwork: (gossipLog, config) => {
		const client = new NetworkClient(gossipLog, "")
	},
}

export default target
