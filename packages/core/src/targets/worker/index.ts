import type pg from "pg"

import { SqlStorage } from "@cloudflare/workers-types"

import { GossipLog as DurableObjectsGossipLog } from "@canvas-js/gossiplog/do"
import { NetworkServer } from "@canvas-js/gossiplog/server"
import { assert } from "@canvas-js/utils"
import { createAPI } from "@canvas-js/core/api"

import type { PlatformTarget } from "../interface.js"

const isPostgresConnectionConfig = (
	path: string | pg.ConnectionConfig | SqlStorage | null,
): path is pg.ConnectionConfig =>
	path !== null &&
	typeof path === "object" &&
	("connectionString" in path || ("user" in path && "host" in path && "database" in path))

const target: PlatformTarget = {
	async openGossipLog(
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string; clear?: boolean },
		init,
	) {
		if (typeof location.path === "string") {
			throw new Error("cannot initialize DurableObjects GossipLog with a path")
		} else if (isPostgresConnectionConfig(location.path)) {
			throw new Error("cannot initialize DurableObjects GossipLog with postgres")
		} else if (location.path === null) {
			throw new Error("cannot initialize DurableObjects GossipLog without a SqlStorage")
		}
		return await DurableObjectsGossipLog.open({ ...init, db: location.path, clear: location.clear })
	},

	async listen(app, port, options = {}) {
		throw new Error("Unimplemented: libp2p listen on Cloudflare Workers")
	},

	buildContract(location: string) {
		throw new Error("Unimplemented: buildContract on Cloudflare Workers")
	},
}

export default target
