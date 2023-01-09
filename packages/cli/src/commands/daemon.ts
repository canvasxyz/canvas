import http from "node:http"
import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import prompts from "prompts"
import chalk from "chalk"
import { createLibp2p, Libp2p } from "libp2p"
import { StatusCodes } from "http-status-codes"
import express from "express"
import cors from "cors"
import winston from "winston"
import expressWinston from "express-winston"
import stoppable from "stoppable"
import Hash from "ipfs-only-hash"
import PQueue from "p-queue"
import { ethers } from "ethers"
import { BlockCache, Core, getLibp2pInit, constants, BlockResolver, getAPI, CoreOptions, VM } from "@canvas-js/core"

import { BlockProvider, Model } from "@canvas-js/interfaces"

import { CANVAS_HOME, SOCKET_FILENAME, SOCKET_PATH, getPeerId, getProviders, installSpec } from "../utils.js"

export const command = "daemon"
export const desc = "Start the canvas daemon"
export const builder = (yargs: yargs.Argv) =>
	yargs
		.option("port", {
			type: "number",
			desc: "Port to bind the Daemon API",
		})
		.option("offline", {
			type: "boolean",
			desc: "Disable libp2p",
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
		.option("unchecked", {
			type: "boolean",
			desc: "Run the node in unchecked mode, without verifying block hashes",
		})
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
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

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	// read rpcs from --chain-rpc arguments or environment variables
	// prompt to run in unchecked mode, if no rpcs were provided
	const providers = getProviders(args["chain-rpc"])
	if (Object.keys(providers).length === 0 && !args.unchecked) {
		const { confirm } = await prompts({
			type: "confirm",
			name: "confirm",
			message: chalk.yellow("No chain RPC provided. Run in unchecked mode instead?"),
			initial: true,
		})

		if (confirm) {
			args.unchecked = true
			args.offline = true
			console.log(chalk.yellow(`✦ ${chalk.bold("Using unchecked mode.")} Actions will not require a valid block hash.`))
		} else {
			console.log(chalk.red("No chain RPC provided! New actions cannot be processed without an RPC."))
		}
	}

	let libp2p: Libp2p | undefined = undefined
	if (!args.offline) {
		const peerId = await getPeerId()
		console.log("[canvas-cli] Using PeerId", peerId.toString())

		if (args.announce) {
			libp2p = await createLibp2p(getLibp2pInit(peerId, args.listen, [args.announce]))
		} else {
			libp2p = await createLibp2p(getLibp2pInit(peerId, args.listen))
		}

		await libp2p.start()
	}

	const blockCache = new BlockCache(providers)

	const daemon = new Daemon(libp2p, providers, blockCache.getBlock, {
		offline: args.offline,
		unchecked: args.unchecked,
		verbose: args.verbose,
	})

	const controller = new AbortController()
	controller.signal.addEventListener("abort", async () => {
		await daemon.close()
		if (libp2p !== undefined) {
			await libp2p.stop()
		}
		blockCache.close()
	})

	if (fs.existsSync(SOCKET_PATH)) {
		fs.rmSync(SOCKET_PATH)
	}

	await startSignalServer(daemon.app, SOCKET_PATH, controller.signal)
	console.log(`[canvas-cli] Daemon API listening on ${SOCKET_PATH}`)

	if (args.port !== undefined) {
		await startSignalServer(daemon.app, args.port, controller.signal)
		console.log(`[canvas-cli] Daemon API listening on http://127.0.0.1:${args.port}`)
	}

	let stopping: boolean = false
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

type Status = "running" | "stopped"

type AppData = {
	uri: string
	cid: string
	status: Status
	models?: Record<string, Model>
	actions?: string[]
}

class Daemon {
	public readonly app = express()

	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly options: CoreOptions
	private readonly apps = new Map<string, { core: Core; api: express.Express }>()

	constructor(
		libp2p: Libp2p | undefined,
		providers: Record<string, BlockProvider>,
		blockResolver: BlockResolver,
		options: CoreOptions
	) {
		this.options = options
		this.app.use(express.json())
		this.app.use(express.text())
		this.app.use(cors())
		this.app.use(
			expressWinston.logger({
				transports: [new winston.transports.Console()],
				format: winston.format.simple(),
				meta: true, // optional: control whether you want to log the meta data about the request (default to true)
				msg: "HTTP {{req.method}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
				expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
				colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
				ignoreRoute: function (req, res) {
					// /app/ is noisy, so don't log it
					return req.path == "/app/" && res.statusCode == StatusCodes.OK
					// return false
				}, // optional: allows to skip some log messages based on request and/or response
			})
		)

		this.app.get("/app", (req, res) => {
			this.queue.add(async () => {
				const apps: Record<string, AppData> = {}
				for (const name of fs.readdirSync(CANVAS_HOME)) {
					if (name === constants.PEER_ID_FILENAME || name === SOCKET_FILENAME) {
						continue
					}

					const specPath = path.resolve(CANVAS_HOME, name, constants.SPEC_FILENAME)
					if (fs.existsSync(specPath)) {
						const spec = fs.readFileSync(specPath, "utf-8")
						const cid = await Hash.of(spec)

						const app = this.apps.get(name)

						apps[name] = {
							uri: `ipfs://${cid}`,
							cid,
							status: app ? "running" : "stopped",
							models: app && app.core.vm.models,
							actions: app && app.core.vm.actions,
						}
					}
				}

				res.json(apps)
			})
		})

		this.app.put("/app/:name", (req, res) => {
			const { name } = req.params
			if (typeof req.body !== "string") {
				return res.status(StatusCodes.NOT_ACCEPTABLE).end()
			}

			this.queue.add(async () => {
				const directory = path.resolve(CANVAS_HOME, name)
				if (!fs.existsSync(directory)) {
					fs.mkdirSync(directory)
				}

				const specPath = path.resolve(CANVAS_HOME, name, constants.SPEC_FILENAME)
				if (fs.existsSync(specPath)) {
					return res.status(StatusCodes.CONFLICT).end()
				}

				const cid = await Hash.of(req.body)
				fs.writeFileSync(specPath, req.body)
				res.setHeader("ETag", `"${cid}"`)
				res.status(StatusCodes.OK).end()
			})
		})

		this.app.delete("/app/:name", (req, res) => {
			const { name } = req.params

			this.queue.add(() => {
				const directory = path.resolve(CANVAS_HOME, name)
				if (!fs.existsSync(directory)) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				fs.rmSync(directory, { recursive: true })
				res.status(StatusCodes.OK).end()
			})
		})

		this.app.post("/app", (req, res) => {
			if (typeof req.body !== "string") {
				return res.status(StatusCodes.BAD_REQUEST).end()
			}

			this.queue.add(async () => {
				const hash = await installSpec(req.body)
				console.log(`[canvas-cli] Installed app with hash ${hash}`)
				res.setHeader("Location", `/app/${hash}`)
				res.status(StatusCodes.CREATED).end()
			})
		})

		this.app.post("/app/:name/start", async (req, res) => {
			const { name } = req.params

			this.queue.add(async () => {
				if (this.apps.has(name)) {
					return res.status(StatusCodes.CONFLICT).end()
				}

				const directory = path.resolve(CANVAS_HOME, name)
				if (!fs.existsSync(directory)) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				const specPath = path.resolve(CANVAS_HOME, name, constants.SPEC_FILENAME)
				if (!fs.existsSync(specPath)) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				const spec = fs.readFileSync(specPath, "utf-8")
				let hash
				try {
					hash = await Hash.of(spec)
				} catch (err) {
					console.log(spec)
					const message = err instanceof Error ? err.message : (err as any).toString()
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
				}

				const uri = `ipfs://${hash}`

				try {
					const core = await Core.initialize({
						directory,
						uri,
						spec,
						libp2p,
						providers,
						blockResolver,
						...this.options,
					})

					const api = getAPI(core, {
						exposeModels: true,
						exposeActions: true,
						exposeSessions: true,
						exposeMetrics: true,
					})

					this.apps.set(name, { core, api })
					console.log(`[canvas-cli] Started ${core.uri}`)
					res.status(StatusCodes.OK).end()
				} catch (err) {
					const message = err instanceof Error ? err.message : (err as any).toString()
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
				}
			})
		})

		this.app.post("/app/:name/stop", (req, res) => {
			const { name } = req.params

			this.queue.add(async () => {
				const app = this.apps.get(name)
				if (app === undefined) {
					return res.status(StatusCodes.CONFLICT).end()
				}

				try {
					await app.core.close()
					console.log(`[canvas-cli] Stopped ${name} (${app.core.uri})`)
					res.status(StatusCodes.OK).end()
				} catch (err) {
					const message = err instanceof Error ? err.message : (err as any).toString()
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
				} finally {
					this.apps.delete(name)
				}
			})
		})

		this.app.use("/app/:name", (req, res, next) => {
			const { name } = req.params

			this.queue.add(async () => {
				const app = this.apps.get(name)
				if (app === undefined) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				return app.api(req, res, next)
			})
		})

		this.app.post("/check", (req, res) => {
			if (typeof req.body.spec !== "string") {
				return res.status(StatusCodes.BAD_REQUEST).end()
			}

			const spec = req.body.spec
			console.log(spec)

			this.queue.add(async () => {
				try {
					const result = await VM.validateWithoutCreating({
						uri: "",
						spec,
						providers: {},
					})
					res.status(StatusCodes.OK).json(result)
				} catch (e) {
					res.status(StatusCodes.OK).json({
						valid: false,
						errors: [(e as any).message],
					})
				}
			})
		})
	}

	public async close() {
		await this.queue.onIdle()
		for (const { core } of this.apps.values()) {
			await core.close()
		}
	}
}

function startSignalServer(requestListener: http.RequestListener, listen: string | number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const server = stoppable(http.createServer(requestListener), 0)
		signal.addEventListener("abort", () => server.stop())
		server.listen(listen, () => resolve())
	})
}
