import fs from "node:fs"
import path from "node:path"

import type pg from "pg"

import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/node"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"

const isPostgres = (path: string | pg.ConnectionConfig): boolean =>
	typeof path !== "string" || path.startsWith("postgres://") || path.startsWith("postgresql://")

const target: PlatformTarget = {
	async openGossipLog(location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean }, init) {
		if (location.path === null) {
			return new SqliteGossipLog(init)
		} else if (isPostgres(location.path)) {
			return await PostgresGossipLog.open(location.path, { ...init, clear: location.clear })
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			const gossipLog = new SqliteGossipLog({ directory: location.path, ...init })

			const manifestPath = path.resolve(location.path, "canvas.json")
			try {
				const manifest: { version: number; topic: string } = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
				if (manifest.topic !== init.topic) {
					throw new Error(`unexpected topic: expected ${init.topic} but found ${manifest.topic} in canvas.json`)
				}
			} catch (err) {
				if (isError(err) && err.code === "ENOENT") {
					const manifest = { version: 1, topic: init.topic }
					fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, "  "))
				} else {
					throw err
				}
			}

			return gossipLog
		}
	},

	createLibp2p: (config) => getLibp2p(config),
}

export default target

function isError(error: any): error is NodeJS.ErrnoException {
	return error instanceof Error
}
