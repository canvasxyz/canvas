import process from "node:process"
import path from "node:path"
import fs from "node:fs"

import http from "node:http"

import yargs from "yargs"
import chalk from "chalk"
import prompts from "prompts"
import stoppable from "stoppable"
import express from "express"
import cors from "cors"
import { createLibp2p, Libp2p } from "libp2p"

import { Core, constants, actionType, getLibp2pInit, getAPI, setupWebsockets, startPingService } from "@canvas-js/core"

import {
	getChainImplementations,
	confirmOrExit,
	parseSpecArgument,
	getPeerId,
	installSpec,
	CANVAS_HOME,
} from "../utils.js"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

export const command = "run <app>"
export const desc = "Run an app, by path or IPFS hash"

export const builder = (yargs: yargs.Argv) =>
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
			type: "number",
			desc: "libp2p WebSocket transport port",
			default: 4044,
		})
		.option("announce", {
			type: "string",
			desc: "Accept incoming libp2p connections on a public multiaddr",
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
		.option("verbose", {
			type: "boolean",
			desc: "Enable verbose logging",
			default: false,
		})
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
		})
		.option("static", {
			type: "string",
			desc: "Serve a static directory from /, and API routes from /api",
		})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	// validate options
	if (args.replay && args.reset) {
		console.log(chalk.red("[canvas-cli] --replay and --reset cannot be used together"))
		process.exit(1)
	}

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

	// read rpcs from --chain-rpc arguments or environment variables
	// prompt to run in unchecked mode, if no rpcs were provided
	const chains = getChainImplementations(args["chain-rpc"])
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

	const { verbose, replay, unchecked, offline, metrics: exposeMetrics, listen: peeringPort, announce } = args

	const peerId = await getPeerId()
	console.log(`[canvas-cli] Using PeerId ${peerId.toString()}`)

	let libp2p: Libp2p | null = null
	if (!offline) {
		if (announce !== undefined) {
			console.log(`[canvas-cli] Announcing on ${announce}`)
			libp2p = await createLibp2p(getLibp2pInit({ peerId, port: peeringPort, announce: [announce] }))
		} else {
			libp2p = await createLibp2p(getLibp2pInit({ peerId, port: peeringPort }))
		}

		if (verbose) {
			libp2p.addEventListener("peer:connect", ({ detail: { id, remotePeer } }) =>
				console.log(`[canvas-cli] Connected to ${remotePeer.toString()} (${id})`)
			)

			libp2p.addEventListener("peer:disconnect", ({ detail: { id, remotePeer } }) =>
				console.log(`[canvas-cli] Disconnected from ${remotePeer.toString()} (${id})`)
			)
		}
	}

	const core = await Core.initialize({
		directory,
		uri,
		spec: spec,
		libp2p,
		unchecked,
		verbose,
	})

	if (directory !== null && replay) {
		console.log(chalk.green(`[canvas-cli] Replaying action log...`))
		const { vm, messageStore, modelStore } = core
		let i = 0
		for await (const [id, action] of messageStore.getActionStream()) {
			if (!actionType.is(action)) {
				console.log(chalk.red("[canvas-cli]"), action)
				throw new Error("Invalid action value in action log")
			}

			const effects = await vm.execute(id, action.payload)
			modelStore.applyEffects(action.payload, effects)
			i++
		}

		console.log(chalk.green(`[canvas-cli] Successfully replayed all ${i} entries from the action log.`))
	}

	const app = express()
	app.use(cors())

	if (args.static) {
		if (!/^(.\/)?\w[\w/]*$/.test(args.static)) {
			throw new Error("Invalid directory for static files")
		} else if (!fs.existsSync(args.static)) {
			throw new Error("Invalid directory for static files (path not found)")
		}

		app.use("/api", getAPI(core, { exposeMetrics }))
		app.use(express.static(args.static))
	} else {
		app.use(getAPI(core, { exposeMetrics }))
	}

	const httpServer = http.createServer(app)
	setupWebsockets(httpServer, core)

	const server = stoppable(
		httpServer.listen(args.port, () => {
			const apiPrefix = args.static ? `api/` : ""
			if (args.static) {
				console.log(`Serving static bundle: http://localhost:${args.port}/`)
				console.log(`Serving API for ${core.app}:`)
				console.log(`└ GET http://localhost:${args.port}/api`)
			} else {
				console.log(`Serving API for ${core.app}:`)
				console.log(`└ GET http://localhost:${args.port}`)
			}
			for (const name of Object.keys(core.vm.routes)) {
				console.log(`└ GET http://localhost:${args.port}/${apiPrefix}${name.slice(1)}`)
			}
			console.log(`└ POST /${apiPrefix}actions`)
			console.log(`└ POST /${apiPrefix}sessions`)
		}),
		0
	)

	const controller = new AbortController()

	if (libp2p !== null) {
		startPingService(libp2p, controller, { verbose })
	}

	controller.signal.addEventListener("abort", async () => {
		console.log("[canvas-cli] Stopping API server...")
		await new Promise<void>((resolve, reject) => server.stop((err) => (err ? reject(err) : resolve())))
		console.log("[canvas-cli] API server stopped.")

		console.log("[canvas-cli] Closing core...")
		await core.close()
		console.log("[canvas-cli] Core closed.")
		if (libp2p !== null) {
			await libp2p.stop()
		}
	})

	let stopping = false
	process.on("SIGINT", () => {
		if (stopping) {
			process.exit(1)
		} else {
			stopping = true
			process.stdout.write(
				`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
			)

			controller.abort()
		}
	})
}
