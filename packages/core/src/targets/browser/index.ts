import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"

import type { PlatformTarget } from "../interface.js"

const version = 2

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open({ ...init, version })
	},

	async listen(app, port, options) {
		throw new Error("Cannot start API server in the browser")
	},
}

export default target
