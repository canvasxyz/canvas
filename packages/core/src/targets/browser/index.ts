import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb"
import { NetworkClient } from "@canvas-js/gossiplog/network/client"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	openGossipLog: ({ path }, init) => {
		return IdbGossipLog.open(init)
	},

	async connect(gossipLog, url, signal) {
		const client = new NetworkClient(gossipLog, url)
		signal.addEventListener("abort", () => client.close())
	},

	async listen(gossipLog, port, signal) {
		throw new Error("Cannot start API server in the browser")
	},
}

export default target
