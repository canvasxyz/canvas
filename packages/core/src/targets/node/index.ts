import fs from "node:fs"
import path from "node:path"

import type pg from "pg"

import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { NetworkServer } from "@canvas-js/gossiplog/network/server"
import { NetworkPeer } from "@canvas-js/gossiplog/network/peer"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"
import { NetworkClient } from "@canvas-js/gossiplog/network/client"

const isPostgres = (path: string | pg.ConnectionConfig): boolean =>
	typeof path !== "string" || path.startsWith("postgres://") || path.startsWith("postgresql://")

const isError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error

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

	async connect(gossipLog, url, signal) {
		const client = new NetworkClient(gossipLog, url)
		signal.addEventListener("abort", () => client.close())
	},

	async listen(gossipLog, handle, signal) {
		if (typeof handle === "number") {
			const server = new NetworkServer(gossipLog)
			server.listen(handle)
			signal.addEventListener("abort", () => server.close())
		} else {
			const peer = await NetworkPeer.create(gossipLog, handle)
			signal.addEventListener("abort", () => peer.stop())
		}
	},
}

export default target
