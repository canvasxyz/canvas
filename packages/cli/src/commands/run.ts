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

import { Canvas } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"
import { MIN_CONNECTIONS, MAX_CONNECTIONS } from "@canvas-js/core/constants"
import { defaultBootstrapList, testnetBootstrapList } from "@canvas-js/core/bootstrap"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import { getContractLocation } from "../utils.js"

export const command = "run <path>"
export const desc = "Run a Canvas application"

export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			desc: "Path to application directory or *.canvas.js contract",
			type: "string",
			demandOption: true,
		})
		.option("init", {
			desc: "Path to a contract to copy if the application directory does not exist",
			type: "string",
		})
		.option("port", {
			desc: "HTTP API port",
			type: "number",
			default: 8000,
		})
		.option("offline", {
			type: "boolean",
			desc: "Disable libp2p",
			default: false,
		})
		.option("listen", {
			type: "array",
			desc: "Internal /ws multiaddr",
			default: ["/ip4/0.0.0.0/tcp/4444/ws"],
		})
		.option("announce", {
			type: "array",
			desc: "External /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws",
		})
		.option("replay", {
			type: "boolean",
			desc: "Erase and rebuild the database by replaying the action log",
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
		.option("static", {
			type: "string",
			desc: "Serve a static directory from the root path /",
		})
		.option("testnet", {
			type: "boolean",
			desc: "Bootstrap to the private testnet (requires VPN)",
		})
		.option("bootstrap", {
			type: "array",
			desc: "Use custom bootstrap servers",
		})
		.option("min-connections", {
			type: "number",
			desc: "Auto-dial peers while below a threshold",
			default: MIN_CONNECTIONS,
		})
		.option("max-connections", {
			type: "number",
			desc: "Stop accepting connections above a limit",
			default: MAX_CONNECTIONS,
		})
		.option("discovery-topic", {
			type: "string",
			desc: "Enable active peer discovery via GossipSub",
		})
		.option("verbose", {
			type: "boolean",
			desc: "Log messages to stdout",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { contract, location } = getContractLocation(args)

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
	if (args.offline) {
		bootstrapList = []
	} else if (args.testnet) {
		console.log(chalk.yellowBright("[canvas] Using testnet bootstrap servers"))
		bootstrapList = testnetBootstrapList
	} else if (args.bootstrap !== undefined) {
		console.log(chalk.yellowBright("[canvas] Using custom bootstrap servers"))
		bootstrapList = []
		for (const address of args.bootstrap) {
			if (typeof address === "string") {
				console.log(chalk.yellowBright(`[canvas] - ${address}`))
				bootstrapList.push(address)
			}
		}
	} else {
		console.log(chalk.gray("[canvas] Using default Canvas bootstrap servers"))
		bootstrapList = defaultBootstrapList
	}

	const app = await Canvas.initialize({
		path: location,
		contract,
		signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner(), new SolanaSigner()],
		listen,
		announce,
		minConnections: args["min-connections"],
		maxConnections: args["max-connections"],
		bootstrapList: bootstrapList,
		offline: args.offline,
		discoveryTopic: args["discovery-topic"],
	})

	console.log(`${chalk.gray("[canvas] Starting app on topic")} ${chalk.whiteBright(app.topic)}`)
	console.log(chalk.gray(`[canvas] Using PeerId ${app.peerId.toString()}`))

	app.libp2p.addEventListener("connection:open", ({ detail: connection }) => {
		const peer = connection.remotePeer.toString()
		const addr = connection.remoteAddr.decapsulateCode(421).toString()
		console.log(chalk.gray(`[canvas] Opened connection to ${peer} at ${addr}`))
	})

	app.libp2p.addEventListener("connection:close", ({ detail: connection }) => {
		const peer = connection.remotePeer.toString()
		const addr = connection.remoteAddr.decapsulateCode(421).toString()
		console.log(chalk.gray(`[canvas] Closed connection to ${peer} at ${addr}`))
	})

	app.messageLog.addEventListener("message", ({ detail: { id, message } }) => {
		if (args["verbose"]) {
			const { type, ...payload } = message.payload
			console.log(`[canvas] Applied message ${chalk.green(id)}`, { type, ...payload })
		} else {
			console.log(`[canvas] Applied message ${chalk.green(id)}`)
		}
	})

	app.messageLog.addEventListener("error", ({ detail: { error } }) => {
		if (args["verbose"]) {
			console.log(`[canvas] ${error.name}:`, error.stack)
		} else {
			console.log(`[canvas] ${error.name}: ${error.message}`)
		}
	})

	app.messageLog.addEventListener("sync", ({ detail: { peer, duration, messageCount } }) => {
		console.log(
			chalk.magenta(
				`[canvas] Completed merkle sync with peer ${peer}: applied ${messageCount} messages in ${duration}ms`,
			),
		)
	})

	// await app.start()

	const api = express()
	api.use(cors())
	api.use(
		"/api",
		createAPI(app, { exposeMetrics: args.metrics, exposeP2P: true, exposeModels: true, exposeMessages: true }),
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

			console.log(`Serving HTTP API:`)
			console.log(`└ GET  ${origin}/api/`)

			console.log(`└ GET  ${origin}/api/clock`)
			console.log(`└ GET  ${origin}/api/messages`)
			console.log(`└ GET  ${origin}/api/messages/:id`)
			console.log(`└ POST ${origin}/api/messages`)

			const { models } = app.getApplicationData()
			for (const name of Object.keys(models)) {
				console.log(`└ GET  ${origin}/api/models/${name}`)
				console.log(`└ GET  ${origin}/api/models/${name}/:key`)
			}

			console.log(`└ GET  ${origin}/api/connections`)
			console.log(`└ GET  ${origin}/api/peers`)
			console.log(`└ POST ${origin}/api/ping/:peerId`)
		}),
		0,
	)

	let stopping = false
	process.on("SIGINT", async () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`,
			)

			console.log("[canvas] Stopping API server...")
			await new Promise<void>((resolve, reject) => server.stop((err) => (err ? reject(err) : resolve())))
			console.log("[canvas] API server stopped.")

			console.log("[canvas] Closing core...")
			await app.close()
			console.log("[canvas] Core closed, press Ctrl+C to terminate immediately.")
		}
	})
}
