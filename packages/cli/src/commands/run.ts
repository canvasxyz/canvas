import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import assert from "node:assert"
import stream from "node:stream"
import process from "node:process"

import type { Argv } from "yargs"
import chalk from "chalk"
import prompts from "prompts"
import stoppable from "stoppable"
import express, { text } from "express"
import cors from "cors"
import { WebSocketServer } from "ws"

import { multiaddr } from "@multiformats/multiaddr"

import { Core, CoreOptions } from "@canvas-js/core"
import { getAPI, handleWebsocketConnection } from "@canvas-js/core/api"

import { testnetBootstrapList } from "@canvas-js/core/bootstrap"
import * as constants from "@canvas-js/core/constants"

import { getChainImplementations, confirmOrExit, parseSpecArgument, installSpec, CANVAS_HOME } from "../utils.js"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { getReasonPhrase, StatusCodes } from "http-status-codes"
import { P2PConfig } from "@canvas-js/core/components/libp2p"

export const command = "run <app>"
export const desc = "Run an app, by path or IPFS hash"

export const builder = (yargs: Argv) =>
	yargs
		.positional("app", {
			describe: "Path to app file, or IPFS hash of app",
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
		.option("install", {
			type: "boolean",
			desc: "Install a local app and run it in production mode",
			default: false,
		})
		.option("listen", {
			type: "array",
			desc: "Internal libp2p /ws multiaddr, e.g. /ip4/0.0.0.0/tcp/4444/ws",
		})
		.option("announce", {
			type: "array",
			desc: "Public libp2p /ws multiaddr, e.g. /dns4/myapp.com/tcp/4444/ws",
		})
		.option("reset", {
			type: "boolean",
			desc: "Reset the message log and model databases",
			default: false,
		})
		.option("replay", {
			type: "boolean",
			desc: "Reconstruct the model database by replying the message log",
			default: false,
		})
		.option("unchecked", {
			type: "boolean",
			desc: "Run the node in unchecked mode, without verifying block hashes",
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
		.option("verbose", {
			type: "boolean",
			desc: "Enable verbose logging",
			default: false,
		})
		.option("chain", {
			type: "array",
			desc: "Declare chain implementations and provide RPC endpoints for reading on-chain data (format: {chain} or {chain}={URL})",
		})
		.option("static", {
			type: "string",
			desc: "Serve a static directory from /, and API routes from /api",
		})
		.option("testnet", {
			type: "boolean",
			desc: "Bootstrap to the private testnet (requires VPN)",
		})
		.option("min-connections", {
			type: "number",
			desc: "Auto-dial peers while below a threshold",
			default: constants.MIN_CONNECTIONS,
		})
		.option("max-connections", {
			type: "number",
			desc: "Stop accepting connections above a limit",
			default: constants.MAX_CONNECTIONS,
		})

type Args = ReturnType<typeof builder> extends Argv<infer T> ? T : never

export async function handler(args: Args) {
	// validate options
	if (args.replay && args.reset) {
		console.log(chalk.red("[canvas-cli] --replay and --reset cannot be used together"))
		process.exit(1)
	}

	// eslint-disable-next-line
	let { directory, uri, spec } = parseSpecArgument(args.app)
	if (directory === null && args.install) {
		const cid = await installSpec(spec)
		directory = path.resolve(CANVAS_HOME, cid)
		uri = `ipfs://${cid}`
	}

	if (directory === null) {
		if (args.replay || args.reset) {
			console.log(chalk.red("[canvas-cli] --replay and --reset cannot be used with temporary development databases"))
			process.exit(1)
		}
	} else if (!fs.existsSync(directory)) {
		console.log(`[canvas-cli] Creating new directory ${directory}`)
		fs.mkdirSync(directory)
	} else if (args.reset) {
		await confirmOrExit(`Are you sure you want to ${chalk.bold("erase all data")} in ${directory}?`)
		const peerIdPath = path.resolve(directory, constants.PEER_ID_FILENAME)
		if (fs.existsSync(peerIdPath)) {
			fs.rmSync(peerIdPath)
			console.log(`[canvas-cli] Deleted ${peerIdPath}`)
		}

		const messagesPath = path.resolve(directory, constants.MESSAGE_DATABASE_FILENAME)
		if (fs.existsSync(messagesPath)) {
			fs.rmSync(messagesPath)
			console.log(`[canvas-cli] Deleted ${messagesPath}`)
		}

		const modelsPath = path.resolve(directory, constants.MODEL_DATABASE_FILENAME)
		if (fs.existsSync(modelsPath)) {
			fs.rmSync(modelsPath)
			console.log(`[canvas-cli] Deleted ${modelsPath}`)
		}

		const mstPath = path.resolve(directory, constants.MST_DIRECTORY_NAME)
		if (fs.existsSync(mstPath)) {
			fs.rmSync(mstPath, { recursive: true })
			console.log(`[canvas-cli] Deleted ${mstPath}`)
		}
	} else if (args.replay) {
		await confirmOrExit(`Are you sure you want to ${chalk.bold("regenerate all model tables")} in ${directory}?`)
		const modelsPath = path.resolve(directory, constants.MODEL_DATABASE_FILENAME)
		if (fs.existsSync(modelsPath)) {
			fs.rmSync(modelsPath)
			console.log(`[canvas-cli] Deleted ${modelsPath}`)
		}
	}

	// read rpcs from --chain arguments or environment variables
	// prompt to run in unchecked mode, if no rpcs were provided
	const chains = getChainImplementations(args["chain"])
	if (chains.length === 0 && !args.unchecked) {
		const { confirm } = await prompts({
			type: "confirm",
			name: "confirm",
			message: chalk.yellow("No chain RPC provided. Run in unchecked mode instead?"),
			initial: true,
		})

		if (confirm) {
			args.unchecked = true
			args.offline = true
			chains.push(new EthereumChainImplementation())
			console.log(chalk.yellow(`✦ ${chalk.bold("Using unchecked mode.")} Actions will not require a valid block hash.`))
		} else {
			console.log(chalk.red("No chain RPC provided! New actions cannot be processed without an RPC."))
		}
	}

	if (directory === null) {
		console.log(
			chalk.yellow(`✦ ${chalk.bold("Using development mode.")} Actions will be signed with the app filename.`)
		)

		console.log(chalk.yellow(`✦ ${chalk.bold("Using in-memory database.")} Data will be lost on restart.`))
		console.log(chalk.yellow(`✦ ${chalk.bold("To persist data, install the app:")} canvas install ${args.app}`))
		console.log("")
	}

	const options: CoreOptions = {
		replay: args.replay,
		offline: directory === null || args.offline,
		unchecked: args.unchecked,
		verbose: args.verbose,
	}

	const announce: string[] = []
	for (const address of args.announce ?? []) {
		assert(typeof address === "string", "--announce address must be a string")
		const addr = multiaddr(address)
		assert(addr.protoNames().pop() === "ws", "--announce address must be a /ws multiaddr")
		announce.push(address)
	}

	const listen: string[] = []
	for (const address of args.listen ?? []) {
		assert(typeof address === "string", "--listen address must be a string")
		const addr = multiaddr(address)
		assert(addr.protoNames().pop() === "ws", "--listen address must be a /ws multiaddr")
		listen.push(address)
	}

	const p2pConfig: P2PConfig = {
		listen,
		announce,
		minConnections: args["min-connections"],
		maxConnections: args["max-connections"],
	}

	if (args.testnet) {
		console.log(chalk.yellowBright("[canvas-cli] Using testnet bootstrap servers"), testnetBootstrapList)
		p2pConfig.bootstrapList = testnetBootstrapList
	}

	const core = await Core.initialize({ chains, directory, uri, spec, ...p2pConfig, ...options })

	const app = express()
	app.use(cors())

	if (args.static) {
		if (!/^(.\/)?\w[\w/]*$/.test(args.static)) {
			throw new Error("Invalid directory for static files")
		} else if (!fs.existsSync(args.static)) {
			throw new Error("Invalid directory for static files (path not found)")
		}

		app.use("/api", getAPI(core, { exposeMetrics: args.metrics, exposeP2P: args.p2p }))
		app.use(express.static(args.static))
	} else {
		app.use(getAPI(core, { exposeMetrics: args.metrics, exposeP2P: args.p2p }))
	}

	const origin = `http://localhost:${args.port}`
	const apiURL = args.static ? `${origin}/api` : origin

	const server = stoppable(
		http.createServer(app).listen(args.port, () => {
			if (args.static) {
				console.log(`Serving static bundle: ${chalk.bold(origin)}`)
			}

			console.log(`Serving HTTP API for ${core.app}:`)
			console.log(`└ POST ${apiURL}/`)
			console.log(`└ GET  ${apiURL}`)
			for (const name of core.vm.getRoutes()) {
				console.log(`└ GET  ${apiURL}/${name.slice(1)}`)
			}
		}),
		0
	)

	const wss = new WebSocketServer({ noServer: true })

	const { pathname } = new URL(apiURL)
	server.on("upgrade", (req: http.IncomingMessage, socket: stream.Duplex, head: Buffer) => {
		if (req.url === undefined) {
			return
		}

		const url = new URL(req.url, origin)
		if (url.pathname === pathname) {
			wss.handleUpgrade(req, socket, head, (socket) =>
				handleWebsocketConnection(core, socket, { verbose: options.verbose })
			)
		} else {
			console.log(chalk.red("[canvas-cli] rejecting incoming WS connection at unexpected path"), url.pathname)
			rejectRequest(socket, StatusCodes.NOT_FOUND)
		}
	})

	let stopping = false
	process.on("SIGINT", async () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
			)

			console.log("[canvas-cli] Stopping API server...")
			await new Promise<void>((resolve, reject) => server.stop((err) => (err ? reject(err) : resolve())))
			console.log("[canvas-cli] API server stopped.")

			console.log("[canvas-cli] Closing core...")
			await core.close()
			console.log("[canvas-cli] Core closed, press Ctrl+C to terminate immediately.")
		}
	})
}

function rejectRequest(reqSocket: stream.Duplex, code: number) {
	const date = new Date()
	reqSocket.write(`HTTP/1.1 ${code} ${getReasonPhrase(code)}\r\n`)
	reqSocket.write(`Date: ${date.toUTCString()}\r\n`)
	reqSocket.write(`\r\n`)
	reqSocket.end()
}
