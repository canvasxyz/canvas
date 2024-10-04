import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import express from "express"
import cors from "cors"

import type pg from "pg"
import { WebSocketServer } from "ws"

import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { NetworkServer } from "@canvas-js/gossiplog/server"
import { assert } from "@canvas-js/utils"
import { createAPI } from "@canvas-js/core/api"
import { SqlStorage } from "@cloudflare/workers-types"

import type { PlatformTarget } from "../interface.js"
import { anySignal } from "any-signal"

const isPostgresConnectionConfig = (
	path: string | pg.ConnectionConfig | SqlStorage | null,
): path is pg.ConnectionConfig =>
	path !== null &&
	typeof path === "object" &&
	("connectionString" in path || ("user" in path && "host" in path && "database" in path))

const isPostgres = (path: string | pg.ConnectionConfig | SqlStorage): boolean =>
	isPostgresConnectionConfig(path) ||
	(typeof path === "string" && (path.startsWith("postgres://") || path.startsWith("postgresql://")))

const isError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error

const target: PlatformTarget = {
	async openGossipLog(
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string; clear?: boolean },
		init,
	) {
		if (location.path === null) {
			return new SqliteGossipLog(init)
		} else if (isPostgres(location.path)) {
			return await PostgresGossipLog.open(location.path as string | pg.ConnectionConfig, {
				...init,
				clear: location.clear,
			})
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

	async listen(app, port, options = {}) {
		const api = express()
		api.use(cors())
		api.use("/api", createAPI(app))

		// TODO: add metrics API

		const server = http.createServer(api)
		const network = new NetworkServer(app.messageLog)
		const wss = new WebSocketServer({ server, perMessageDeflate: false })
		wss.on("connection", network.handleConnection)

		const signal = anySignal([app.messageLog.controller.signal, options.signal])
		signal.addEventListener("abort", () => {
			network.close()
			wss.close(() => server.close())
		})

		await new Promise<void>((resolve) => server.listen(port, resolve))
	},
}

export default target
