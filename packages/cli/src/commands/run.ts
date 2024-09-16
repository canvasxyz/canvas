import fs from "node:fs"
import http from "node:http"
import assert from "node:assert"
import process from "node:process"

import type { Argv } from "yargs"
import chalk from "chalk"
import express from "express"
import cors from "cors"
import { WebSocketServer } from "ws"
import { multiaddr } from "@multiformats/multiaddr"
import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"

import dotenv from "dotenv"

dotenv.config()

import { Canvas } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"
import { MIN_CONNECTIONS, MAX_CONNECTIONS } from "@canvas-js/core/constants"
import { NetworkServer } from "@canvas-js/gossiplog/server"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import { getContractLocation } from "../utils.js"
import { startActionPrompt } from "../prompt.js"

export const command = "run <path>"
export const desc = "Run a Canvas application"

const { ANNOUNCE, LISTEN, BOOTSTRAP_LIST, PORT } = process.env

export const builder = (yargs: Argv) =>
	yargs
		.positional("path", {
			desc: "Path to application directory or *.js/*.ts contract",
			type: "string",
			demandOption: true,
		})
		.option("topic", {
			desc: "Application topic",
			type: "string",
		})
		.option("init", {
			desc: "Path to a contract to copy if the application directory does not exist",
			type: "string",
		})
		.option("port", {
			desc: "HTTP API port",
			type: "number",
			default: parseInt(PORT ?? "8000"),
		})
		.option("offline", {
			type: "boolean",
			desc: "Disable libp2p",
			default: false,
		})
		.option("listen", {
			type: "array",
			desc: "Internal /ws multiaddr",
			default: LISTEN?.split(" ") ?? ["/ip4/0.0.0.0/tcp/4444/ws"],
		})
		.option("announce", {
			type: "array",
			desc: "External /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws",
			default: ANNOUNCE?.split(" ") ?? [],
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
		.option("bootstrap", {
			type: "array",
			desc: "Initial application peers, e.g. /dns4/myapp.com/tcp/4444/ws/p2p/12D3KooWnzt...",
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
		.option("verbose", {
			type: "boolean",
			desc: "Log messages to stdout",
		})
		.option("disable-http-api", {
			type: "boolean",
			desc: "Disable HTTP API server",
		})
		.option("repl", {
			type: "boolean",
			desc: "Start an action REPL",
			default: false,
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	const { topic, contract, location } = getContractLocation(args)

	if (location === null) {
		console.log(chalk.yellow(`✦ ${chalk.bold("Running app in-memory only.")} No data will be persisted.`))
		console.log("")
	}

	const announce: string[] = []
	for (const address of args.announce) {
		assert(typeof address === "string", "announce address must be a string")
		const addr = multiaddr(address)
		assert(
			WebSockets.exactMatch(addr) || WebSocketsSecure.exactMatch(addr),
			"announce address must be a /ws or /wss multiaddr",
		)

		announce.push(address)
	}

	const listen: string[] = []
	for (const address of args.listen) {
		assert(typeof address === "string", "listen address must be a string")
		const addr = multiaddr(address)
		assert(
			WebSockets.exactMatch(addr) || WebSocketsSecure.exactMatch(addr),
			"listen address must be a /ws or /wss multiaddr",
		)

		listen.push(address)
	}

	let bootstrapList: string[] = []
	if (args.offline) {
		bootstrapList = []
	} else if (args.bootstrap !== undefined) {
		console.log(chalk.yellowBright("[canvas] Using custom bootstrap servers"))
		bootstrapList = []
		for (const address of args.bootstrap) {
			assert(typeof address === "string", "bootstrap address must be a string")
			console.log(chalk.yellowBright(`[canvas] - ${address}`))
			bootstrapList.push(address)
		}
	} else if (BOOTSTRAP_LIST !== undefined) {
		bootstrapList = BOOTSTRAP_LIST.split(" ")
		console.log(chalk.yellowBright("[canvas] Using custom bootstrap servers"))
		for (const address of bootstrapList) {
			console.log(chalk.yellowBright(`[canvas] - ${address}`))
		}
	}

	console.log(`${chalk.gray("[canvas] Starting app on topic")} ${chalk.whiteBright(topic)}`)

	const signers = [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner(), new SolanaSigner()]
	const app = await Canvas.initialize({ path: location, topic, contract, signers })

	app.addEventListener("message", ({ detail: { id, message } }) => {
		if (args["verbose"]) {
			console.log(`[canvas] Applied message ${chalk.green(id)}`, message.payload)
		} else {
			console.log(`[canvas] Applied message ${chalk.green(id)}`)
		}
	})

	app.addEventListener("sync", ({ detail: { peer, duration, messageCount } }) => {
		console.log(
			chalk.magenta(
				`[canvas] Completed merkle sync with peer ${peer}: applied ${messageCount} messages in ${duration}ms`,
			),
		)
	})

	if (!args["offline"]) {
		// TODO: cache peer ID in .peer-id file
		const libp2p = await app.startLibp2p({
			listen,
			announce,
			minConnections: args["min-connections"],
			maxConnections: args["max-connections"],
			bootstrapList: bootstrapList,
		})

		console.log(chalk.gray(`[canvas] Using PeerId ${libp2p.peerId.toString()}`))
		for (const addr of listen) {
			console.log(chalk.gray(`[canvas] Listening on ${addr}/p2p/${libp2p.peerId.toString()}`))
		}

		app.addEventListener("connect", ({ detail: { peer } }) => {
			console.log(chalk.gray(`[canvas] Opened connection to ${peer}`))
		})

		app.addEventListener("disconnect", ({ detail: { peer } }) => {
			console.log(chalk.gray(`[canvas] Closed connection to ${peer}`))
		})
	}

	const controller = new AbortController()
	controller.signal.addEventListener("abort", () => {
		console.log("[canvas] Closing app...")
		app.stop().then(() => console.log("[canvas] App closed"))
	})

	if (!args["disable-http-api"]) {
		const api = express()
		api.use(cors())
		api.use("/api", createAPI(app))

		// TODO: add metrics API
		//
		if (args.static !== undefined) {
			assert(/^(.\/)?\w[\w/]*$/.test(args.static), "Invalid directory for static files")
			assert(fs.existsSync(args.static), "Invalid directory for static files (path not found)")
			api.use(express.static(args.static))
		}

		const server = http.createServer(api)
		const network = new NetworkServer(app.messageLog)
		const wss = new WebSocketServer({ server, perMessageDeflate: false })
		wss.on("connection", network.handleConnection)

		controller.signal.addEventListener("abort", () => {
			console.log("[canvas] Stopping HTTP API server...")
			network.close()
			wss.close(() => server.close(() => console.log("[canvas] HTTP API server stopped.")))
		})

		await new Promise<void>((resolve) => server.listen(args["port"], resolve))

		const origin = `http://localhost:${args.port}`
		console.log("")
		if (args.static) {
			console.log(`Serving static bundle: ${chalk.bold(origin)}`)
		}

		console.log(`Serving HTTP API:`)
		console.log(`└ GET  ${origin}/api/`)

		console.log(`└ GET  ${origin}/api/clock`)
		console.log(`└ GET  ${origin}/api/messages`)
		console.log(`└ GET  ${origin}/api/messages/:id`)
		console.log(`└ POST ${origin}/api/messages`)

		const { models, actions } = app.getApplicationData()
		for (const name of Object.keys(models)) {
			console.log(`└ GET  ${origin}/api/models/${name}`)
			console.log(`└ GET  ${origin}/api/models/${name}/:key`)
		}

		console.log("")
		console.log("Actions:")
		for (const action of actions) {
			console.log(`└ ${action}`)
		}
	}

	let stopping = false
	process.on("SIGINT", async () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`,
			)

			controller.abort()
		}
	})

	if (args["repl"]) {
		console.log("")
		startActionPrompt(app)
	}
}
