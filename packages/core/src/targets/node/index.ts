import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import express from "express"
import cors from "cors"
import { anySignal } from "any-signal"

import chalk from "chalk"

import * as pg from "pg"
import { WebSocketServer } from "ws"

import { NetworkServer } from "@canvas-js/gossiplog/server"
import { assert } from "@canvas-js/utils"
import { createAPI } from "@canvas-js/core/api"
import type { SqlStorage } from "@cloudflare/workers-types"

import type { PlatformTarget } from "../interface.js"
import { stripBundleFilename } from "../../utils.js"

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
	async openGossipLog(location: { path: string | pg.ConnectionConfig | SqlStorage | null; topic: string }, init) {
		if (location.path === null) {
			const { GossipLog: SqliteGossipLog } = await import("@canvas-js/gossiplog/sqlite")
			return await SqliteGossipLog.open(null, init)
		} else if (isPostgres(location.path)) {
			const { GossipLog: PostgresGossipLog } = await import("@canvas-js/gossiplog/pg")
			return await PostgresGossipLog.open(location.path as string | pg.ConnectionConfig, {
				...init,
				clear: init.clear,
			})
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			const { GossipLog: SqliteGossipLog } = await import("@canvas-js/gossiplog/sqlite")
			const gossipLog = await SqliteGossipLog.open(location.path, init)

			const manifestPath = path.resolve(location.path, "canvas.json")
			try {
				const manifest: { version: number; topic: string } = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
				if (manifest.topic !== init.topic.replace(/#[A-Za-z0-9]+$/, "")) {
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

	async buildContract(contract: string) {
		const esbuild = await import("esbuild")
		const bundle = await esbuild.build({
			bundle: true,
			platform: "node",
			format: "esm",
			write: false,
			external: ["@canvas-js/core"],
			stdin: {
				contents: contract,
				loader: "ts",
				sourcefile: "virtual-contract.ts",
			},
		})

		if (!bundle.outputFiles || bundle.outputFiles.length === 0) {
			throw new Error("building contract from string produced no files")
		} else {
			return { build: stripBundleFilename(bundle.outputFiles[0].text), originalContract: contract }
		}
	},

	async buildContractByLocation(location: string) {
		const originalContract = fs.readFileSync(location, "utf-8")
		const esbuild = await import("esbuild")
		const bundle = await esbuild.build({
			bundle: true,
			platform: "node",
			format: "esm",
			write: false,
			external: ["@canvas-js/core"],
			entryPoints: [location],
		})
		if (!bundle.outputFiles || bundle.outputFiles.length === 0) {
			throw new Error("building .ts contract produced no files")
		} else if (bundle.outputFiles && bundle.outputFiles.length > 1) {
			// unexpected
			return { build: stripBundleFilename(bundle.outputFiles[0].text), originalContract }
		} else {
			return { build: stripBundleFilename(bundle.outputFiles[0].text), originalContract }
		}
	},
}

export default target
