import type pg from "pg"
import type { SqlStorage } from "@cloudflare/workers-types"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openGossipLog(
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string },
		init,
	) {
		if (location.path === null) {
			const { GossipLog } = await import("@canvas-js/gossiplog/sqlite-expo")
			return await GossipLog.open({ ...init, clear: init.clear })
		} else {
			throw new Error("Unimplemented: named sqlite dbs on react-native")
		}
	},

	async listen(app, port, options = {}) {
		throw new Error("Unimplemented: libp2p listen on react-native")
	},

	buildContract(contract: string) {
		throw new Error("Unimplemented: buildContract on react-native")
	},

	buildContractByLocation(location: string) {
		throw new Error("Unimplemented: buildContractByLocation on react-native")
	},
}

export default target
