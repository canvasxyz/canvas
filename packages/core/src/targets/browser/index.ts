import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	async listen(app, port, options) {
		throw new Error("Cannot start API server in the browser")
	},
}

export default target
