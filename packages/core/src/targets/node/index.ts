import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import express from "express"
import cors from "cors"
import { anySignal } from "any-signal"

import esbuild from "esbuild"
import chalk from "chalk"

import type pg from "pg"
import { WebSocketServer } from "ws"

import { NetworkServer } from "@canvas-js/gossiplog/server"
import { assert } from "@canvas-js/utils"
import { createAPI } from "@canvas-js/core/api"
import type { SqlStorage } from "@cloudflare/workers-types"

import type { PlatformTarget } from "../interface.js"

function isPostgresConnectionConfig(
	path: string | pg.ConnectionConfig | SqlStorage | null,
): path is pg.ConnectionConfig {
	if (path === null || typeof path !== "object") {
		return false
	} else if ("connectionString" in path) {
		return true
	} else {
		return "user" in path && "host" in path && "database" in path
	}
}

function isPostgres(path: string | pg.ConnectionConfig | SqlStorage): boolean {
	if (isPostgresConnectionConfig(path)) {
		return true
	} else if (typeof path === "string") {
		return path.startsWith("postgres://") || path.startsWith("postgresql://")
	} else {
		return false
	}
}

const isError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error

const target: PlatformTarget = {
	async openGossipLog(
		location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string; clear?: boolean },
		init,
	) {
		if (location.path === null) {
			const { GossipLog: SqliteGossipLog } = await import("@canvas-js/gossiplog/sqlite")
			return await SqliteGossipLog.open(null, init)
		} else if (isPostgres(location.path)) {
			const { GossipLog: PostgresGossipLog } = await import("@canvas-js/gossiplog/pg")
			return await PostgresGossipLog.open(location.path as string | pg.ConnectionConfig, {
				...init,
				clear: location.clear,
			})
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			const { GossipLog: SqliteGossipLog } = await import("@canvas-js/gossiplog/sqlite")
			const gossipLog = await SqliteGossipLog.open(location.path, init)

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

	buildContract(location: string) {
		const bundle = esbuild.buildSync({
			bundle: true,
			platform: "node",
			format: "esm",
			write: false,
			entryPoints: [location],
		})
		if (!bundle.outputFiles || bundle.outputFiles.length === 0) {
			console.error(chalk.yellow("[canvas] Building .ts contract produced no files"))
			process.exit(1)
		} else if (bundle.outputFiles && bundle.outputFiles.length > 1) {
			console.warn(chalk.yellow("[canvas] Building .ts contract produced more than one file, likely will not run"))
			return bundle.outputFiles[0].text
		} else {
			console.log(chalk.yellow("[canvas] Bundled .ts contract:"), `${bundle.outputFiles[0].contents.byteLength} bytes`)
			return bundle.outputFiles[0].text
		}
	},
}

export default target
