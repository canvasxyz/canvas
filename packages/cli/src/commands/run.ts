import fs from "node:fs"
import http from "node:http"
import assert from "node:assert"
import process from "node:process"

import { fileURLToPath } from "url"
import path, { dirname } from "path"
import { packageDirectorySync } from "pkg-dir"

import type { Argv } from "yargs"
import chalk from "chalk"
import express from "express"
import cors from "cors"
import { WebSocketServer } from "ws"
import { multiaddr } from "@multiformats/multiaddr"
import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"
import stoppable from "stoppable"
import dotenv from "dotenv"

dotenv.config()

import { Canvas, PeerId } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"
import { MIN_CONNECTIONS, MAX_CONNECTIONS } from "@canvas-js/core/constants"
import { NetworkServer } from "@canvas-js/gossiplog/server"
import { defaultBootstrapList } from "@canvas-js/gossiplog/bootstrap"

import { SIWESigner, Eip712Signer, SIWFSigner } from "@canvas-js/chain-ethereum"
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
		.option("network-explorer", {
			type: "boolean",
			desc: "Serve the network explorer web interface",
		})
		.option("admin", {
			type: "boolean",
			desc: "Allow an admin address to update the running application",
		})
		.option("connect", {
			type: "string",
			desc: "Connect GossipLog directly to this WebSocket URL. If this is enabled, libp2p is disabled.",
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

type AppConfig = {
	path: string
	topic?: string
	init?: string
	port: number
	offline: boolean
	replay: boolean
	memory: boolean

	/* api */
	metrics: boolean
	static?: string

	/* services */
	"disable-http-api"?: boolean
	"network-explorer"?: boolean

	/* application networking */
	connect?: string
	listen: string[] | (string | number)[]
	announce: string[] | (string | number)[]
	bootstrap?: (string | number)[]
	"max-connections": number

	/* etc */
	verbose?: boolean
	repl: boolean
}

async function setupApp(topic: string, contract: string, location_: string | null, args: AppConfig) {
	let location = location_

	if (process.env.DATABASE_URL) {
		location = process.env.DATABASE_URL
		console.log(`[canvas] Using database at ${process.env.DATABASE_URL}`)
	} else if (location === null) {
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

	console.log(`${chalk.gray("[canvas] Starting app on topic")} ${chalk.whiteBright(topic)}`)

	const signers = [
		new SIWESigner(),
		new Eip712Signer(),
		new SIWFSigner(),
		new ATPSigner(),
		new CosmosSigner(),
		new SubstrateSigner(),
		new SolanaSigner(),
	]
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

	if (args["connect"]) {
		await app.connect(args["connect"])
	} else if (!args.offline) {
		let bootstrapList = defaultBootstrapList
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

		// TODO: cache peer ID in .peer-id file
		const libp2p = await app.startLibp2p({
			listen,
			announce,
			maxConnections: args["max-connections"],
			bootstrapList: bootstrapList,
		})

		const id = libp2p.peerId.toString()
		console.log(chalk.gray(`[canvas] Using PeerId ${id}`))

		for (const addr of listen) {
			console.log(chalk.gray(`[canvas] Listening on ${addr}/p2p/${id}`))
		}

		for (const addr of announce) {
			console.log(chalk.gray(`[canvas] Announcing on ${addr}/p2p/${id}`))
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
			assert(/^(.\/)?\w[\w-_/]*$/.test(args.static), "Invalid directory for static files")
			assert(fs.existsSync(args.static), "Invalid directory for static files (path not found)")
			api.use(express.static(args.static))
		}

		if (args["network-explorer"] !== undefined) {
			const currentDirectory = dirname(fileURLToPath(import.meta.url)) // packages/cli/src/commands
			const packageDirectory = packageDirectorySync({ cwd: currentDirectory })
			assert(packageDirectory !== undefined, "Invalid directory for network explorer static files (build not found)")

			const root = packageDirectorySync({ cwd: path.resolve(packageDirectory || ".", "..") })
			if (root !== undefined) {
				// called from development workspace
				const localBuild = path.resolve(root, "packages/network-explorer/dist")
				if (fs.existsSync(localBuild)) {
					console.log(
						chalk.yellow("[canvas] Using development build for network explorer, run `npm run build` to rebuild."),
					)
					api.use(args.static !== undefined ? "/explorer" : "/", express.static(localBuild))
				} else {
					console.log(
						chalk.yellow(
							"[canvas] [dev] Could not find development build, try `npm run build`. Falling back to installed package...",
						),
					)
					const build = path.resolve(root, "node_modules/@canvas-js/network-explorer/dist")
					assert(fs.existsSync(build), "Invalid directory for network explorer static files (build not found)")
					api.use(args.static !== undefined ? "/explorer" : "/", express.static(build))
				}
			} else {
				// called from installed package
				const networkExplorer = path.resolve(packageDirectory, "node_modules/@canvas-js/network-explorer")
				assert(fs.existsSync(networkExplorer), "Could not find network explorer package")
				const build = path.resolve(networkExplorer, "dist")
				assert(fs.existsSync(build), "Invalid directory for network explorer static files (build not found)")
				api.use(args.static !== undefined ? "/explorer" : "/", express.static(build))
			}
		}

		// TODO: move to createAPI
		if (args["admin"] !== undefined) {
			// TODO: merge into snapshot
			api.post("/api/flatten", (req, res) => {
				app
					.createSnapshot()
					.then((snapshot) => {
						res.json({ snapshot })
					})
					.catch((error) => {
						res.status(500).end()
					})
			})

			api.post("/api/snapshot", (req, res) => {
				const { changesets } = req.body ?? {}
				console.log("snapshot requested, changesets:", changesets)

				app
					.createSnapshot()
					.then((snapshot) => {
						res.json({ snapshot })
					})
					.catch((error) => {
						res.status(500).end()
					})
			})
		}

		const server = stoppable(http.createServer(api))
		const network = new NetworkServer(app.messageLog)
		const wss = new WebSocketServer({ server, perMessageDeflate: false })
		wss.on("connection", network.handleConnection)

		controller.signal.addEventListener("abort", () => {
			console.log("[canvas] Stopping HTTP API server...")
			network.close()
			wss.close(() => server.stop(() => console.log("[canvas] HTTP API server stopped.")))
		})

		await new Promise<void>((resolve) => server.listen(args["port"], resolve))

		console.log("")

		const origin = `http://localhost:${args.port}`
		if (args.static) {
			console.log(`Serving static bundle: ${chalk.bold(origin)}`)
		}
		if (args.static && args["network-explorer"] !== undefined) {
			console.log(`Serving network explorer: ${chalk.bold(origin)}/explorer`)
		} else if (args["network-explorer"] !== undefined) {
			console.log(`Serving network explorer: ${chalk.bold(origin)}`)
			api.get("/explorer", (req, res) => {
				res.redirect("/")
			})
		}

		const wsAPI = `ws://localhost:${args.port}`
		console.log(`Connect browser clients to ${chalk.whiteBright(wsAPI)}`)
		console.log("")

		console.log(`Serving HTTP API:`)
		console.log(`└ GET  ${origin}/api/`)
		console.log(`└ GET  ${origin}/api/clock`)
		console.log(`└ GET  ${origin}/api/messages`)
		console.log(`└ GET  ${origin}/api/messages/:id`)
		console.log(`└ POST ${origin}/api/messages/count`)
		console.log(`└ POST ${origin}/api/actions`)
		console.log(`└ POST ${origin}/api/actions/count`)
		console.log(`└ POST ${origin}/api/session`)
		console.log(`└ POST ${origin}/api/sessions/count`)

		const { models, actions } = await app.getApplicationData()
		for (const name of Object.keys(models)) {
			console.log(`└ GET  ${origin}/api/models/${name}`)
			console.log(`└ GET  ${origin}/api/models/${name}/:key`)
		}

		if (args["admin"] !== undefined) {
			console.log(`└ POST ${origin}/api/snapshot`)
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

export async function handler(args: Args) {
	const { topic, contract, location } = await getContractLocation(args)
	setupApp(topic, contract, location, args)
}
