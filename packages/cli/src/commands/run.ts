import fs from "node:fs"
import http from "node:http"
import assert from "node:assert"
import process from "node:process"

import type { Argv } from "yargs"
import chalk from "chalk"
import stoppable from "stoppable"
import express from "express"
import cors from "cors"

import { multiaddr } from "@multiformats/multiaddr"

import { Canvas, defaultBootstrapList, testnetBootstrapList } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"

import { getContractLocation } from "../utils.js"

export const command = "run <path>"
export const desc = "Run a Canvas application"

export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			describe: "Path to application directory or *.canvas.js contract",
			type: "string",
			demandOption: true,
		})
		.option("port", {
			type: "number",
			desc: "Port to bind the Core API",
			default: 8000,
		})
		.option("offline", {
			type: "boolean",
			desc: "Disable libp2p",
			default: false,
		})
		.option("listen", {
			type: "array",
			desc: "Internal libp2p /ws multiaddr",
			default: ["/ip4/0.0.0.0/tcp/4444/ws"],
		})
		.option("announce", {
			type: "array",
			desc: "External libp2p /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws",
		})
		.option("replay", {
			type: "boolean",
			desc: "Rebuild the model database by replying the entire message log",
			default: false,
		})
		.option("memory", {
			type: "boolean",
			desc: "Run in-memory",
			default: false,
		})
		.option("metrics", {
			type: "boolean",
			desc: "Expose Prometheus endpoint at /metrics",
			default: false,
		})
		.option("p2p", {
			type: "boolean",
			desc: "Expose internal libp2p debugging endpoints",
			default: false,
		})
		.option("static", {
			type: "string",
			desc: "Serve a static directory from the root path /",
		})
		.option("testnet", {
			type: "boolean",
			desc: "Bootstrap to the private testnet (requires VPN)",
		})
		.option("min-connections", {
			type: "number",
			desc: "Auto-dial peers while below a threshold",
		})
		.option("max-connections", {
			type: "number",
			desc: "Stop accepting connections above a limit",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { contract, location, uri } = getContractLocation(args)

	if (location === null) {
		console.log(chalk.yellow(`✦ ${chalk.bold("Running app in-memory only.")} No data will be persisted.`))
		console.log("")
	}

	const announce: string[] = []
	for (const address of args.announce ?? []) {
		assert(typeof address === "string", "--announce address must be a string")
		const addr = multiaddr(address)
		const lastProtoName = addr.protoNames().pop()
		assert(lastProtoName === "ws" || lastProtoName === "wss", "--announce address must be a /ws or /wss multiaddr")
		announce.push(address)
	}

	const listen: string[] = []
	for (const address of args.listen ?? []) {
		assert(typeof address === "string", "--listen address must be a string")
		const addr = multiaddr(address)
		const lastProtoName = addr.protoNames().pop()
		assert(lastProtoName === "ws" || lastProtoName === "wss", "--listen address must be a /ws or /wss multiaddr")
		listen.push(address)
	}

	let bootstrapList: string[]
	if (args.testnet) {
		console.log(chalk.yellowBright("[canvas-cli] Using testnet bootstrap servers"), testnetBootstrapList)
		bootstrapList = testnetBootstrapList
	} else {
		console.log(chalk.gray("[canvas-cli] Using default bootstrap servers"), defaultBootstrapList)
		bootstrapList = defaultBootstrapList
	}

	const app = await Canvas.initialize({
		path: location,
		contract,
		listen,
		announce,
		minConnections: args["min-connections"],
		maxConnections: args["max-connections"],
		bootstrapList: bootstrapList,
		offline: args["offline"],
	})

	app.libp2p?.addEventListener("connection:open", ({ detail: connection }) => {
		const peer = connection.remotePeer.toString()
		const addr = connection.remoteAddr.decapsulateCode(421).toString()
		console.log(`[canvas-core] Opened connection to ${peer} at ${addr}`)
	})

	app.libp2p?.addEventListener("connection:close", ({ detail: connection }) => {
		const peer = connection.remotePeer.toString()
		const addr = connection.remoteAddr.decapsulateCode(421).toString()
		console.log(`[canvas-core] Closed connection to ${peer} at ${addr}`)
	})

	if (!args.offline) {
		await app.start()
	}

	const api = express()
	api.use(cors())
	api.use(
		"/api",
		createAPI(app, { exposeMetrics: args.metrics, exposeP2P: args.p2p, exposeModels: true, exposeMessages: true })
	)

	if (args.static !== undefined) {
		assert(/^(.\/)?\w[\w/]*$/.test(args.static), "Invalid directory for static files")
		assert(fs.existsSync(args.static), "Invalid directory for static files (path not found)")
		api.use(express.static(args.static))
	}

	const origin = `http://localhost:${args.port}`

	const server = stoppable(
		http.createServer(api).listen(args.port, () => {
			if (args.static) {
				console.log(`Serving static bundle: ${chalk.bold(origin)}`)
			}

			console.log(`Serving HTTP API for ${uri}:`)
			console.log(`└ GET  ${origin}/api`)

			const { topic, models, actions } = app.getApplicationData()
			for (const name of Object.keys(models)) {
				console.log(`└ GET  ${origin}/api/models/${name}`)
				console.log(`└ GET  ${origin}/api/models/${name}/:key`)
			}

			console.log(`└ GET  ${origin}/api/clock`)
			console.log(`└ GET  ${origin}/api/messages`)
			console.log(`└ GET  ${origin}/api/messages/:id`)
			console.log(`└ POST ${origin}/api/messages`)
		}),
		0
	)

	// const wss = new WebSocketServer({ noServer: true })

	// const { pathname } = new URL(apiURL)
	// server.on("upgrade", (req: http.IncomingMessage, socket: stream.Duplex, head: Buffer) => {
	// 	if (req.url === undefined) {
	// 		return
	// 	}

	// 	const url = new URL(req.url, origin)
	// 	if (url.pathname === pathname) {
	// 		wss.handleUpgrade(req, socket, head, (socket) =>
	// 			handleWebsocketConnection(app, socket, { verbose: args.verbose })
	// 		)
	// 	} else {
	// 		console.log(chalk.red("[canvas-cli] rejecting incoming WS connection at unexpected path"), url.pathname)
	// 		rejectRequest(socket, StatusCodes.NOT_FOUND)
	// 	}
	// })

	let stopping = false
	process.on("SIGINT", async () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
			)

			// if (apiSyncTimer) clearTimeout(apiSyncTimer.timer)

			console.log("[canvas-cli] Stopping API server...")
			await new Promise<void>((resolve, reject) => server.stop((err) => (err ? reject(err) : resolve())))
			console.log("[canvas-cli] API server stopped.")

			console.log("[canvas-cli] Closing core...")
			await app.close()
			console.log("[canvas-cli] Core closed, press Ctrl+C to terminate immediately.")
		}
	})
}

// function rejectRequest(reqSocket: stream.Duplex, code: number) {
// 	const date = new Date()
// 	reqSocket.write(`HTTP/1.1 ${code} ${getReasonPhrase(code)}\r\n`)
// 	reqSocket.write(`Date: ${date.toUTCString()}\r\n`)
// 	reqSocket.write(`\r\n`)
// 	reqSocket.end()
// }
