import type pg from "pg"
import type { SqlStorage } from "@cloudflare/workers-types"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openGossipLog(
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string; clear?: boolean },
		init,
	) {
		if (location.path === null) {
			const { GossipLog } = await import("@canvas-js/gossiplog/sqlite-expo")
			return await GossipLog.open({ ...init, clear: location.clear })
		} else {
			throw new Error("Unimplemented: named sqlite dbs on react-native")
		}
	},

	async listen(app, port, options = {}) {
		throw new Error("Unimplemented: libp2p listen on react-native")
	},

	buildContract(location: string): string {
		throw new Error("Unimplemented: buildContract on react-native")
	},
}

export default target
