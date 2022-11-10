import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import prompts from "prompts"
import chalk from "chalk"
import { createLibp2p, Libp2p } from "libp2p"
import { StatusCodes } from "http-status-codes"
import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import Hash from "ipfs-only-hash"
import PQueue from "p-queue"

import { BlockCache, Core, getLibp2pInit, constants, BlockResolver } from "@canvas-js/core"

import { CANVAS_HOME, getPeerId, getProviders, SOCKET_FILENAME, SOCKET_PATH, startSignalServer } from "../utils.js"
import { handleAction, handleRoute, handleSession } from "../api.js"

import { ethers } from "ethers"

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
		.option("unchecked", {
			type: "boolean",
			desc: "Run the node in unchecked mode, without verifying block hashes",
		})
		.option("chain-rpc", {
			type: "array",
			desc: "Provide an RPC endpoint for reading on-chain data",
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
		libp2p = await createLibp2p(getLibp2pInit(peerId, args.listen))
		await libp2p.start()
	}

	const blockCache = new BlockCache(providers)

	const daemon = new Daemon(libp2p, providers, blockCache.getBlock)

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

	await startSignalServer(daemon.api, SOCKET_PATH, controller.signal)
	console.log(`[canvas-cli] Daemon API listening on ${SOCKET_PATH}`)

	if (args.port !== undefined) {
		await startSignalServer(daemon.api, args.port, controller.signal)
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

class Daemon {
	public readonly api = express()

	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly cores = new Map<string, Core>()

	constructor(
		libp2p: Libp2p | undefined,
		providers: Record<string, ethers.providers.JsonRpcProvider>,
		blockResolver: BlockResolver
	) {
		this.api.use(bodyParser.json())
		this.api.use(cors({ exposedHeaders: ["ETag", "Link"] }))

		this.api.get("/app", (req, res) => {
			this.queue.add(async () => {
				const apps: Record<string, { uri: string; cid: string; status: Status }> = {}
				for (const name of fs.readdirSync(CANVAS_HOME)) {
					if (name === constants.PEER_ID_FILENAME || name === SOCKET_FILENAME) {
						continue
					}

					const status = this.cores.has(name) ? "running" : "stopped"

					const specPath = path.resolve(CANVAS_HOME, name, constants.SPEC_FILENAME)
					if (fs.existsSync(specPath)) {
						const spec = fs.readFileSync(specPath, "utf-8")
						const cid = await Hash.of(spec)
						apps[name] = { uri: `ipfs://${cid}`, cid, status }
					}
				}

				res.json(apps)
			})
		})

		this.api.put("/app/:name", (req, res) => {
			const { name } = req.params

			const contentType = req.headers["content-type"]
			if (contentType !== "text/javascript" || typeof req.body !== "string") {
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

		this.api.delete("/app/:name", (req, res) => {
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

		this.api.post("/app/:name/start", async (req, res) => {
			const { name } = req.params

			this.queue.add(async () => {
				if (this.cores.has(name)) {
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
				const hash = await Hash.of(spec)
				const uri = `ipfs://${hash}`

				try {
					const core = await Core.initialize({ directory, uri, spec, libp2p, providers, blockResolver })
					this.cores.set(name, core)
					console.log(`[canvas-cli] Started ${core.uri}`)
					res.status(StatusCodes.OK).end()
				} catch (err) {
					const message = err instanceof Error ? err.message : (err as any).toString()
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
				}
			})
		})

		this.api.post("/app/:name/stop", (req, res) => {
			const { name } = req.params

			this.queue.add(async () => {
				const core = this.cores.get(name)
				if (core === undefined) {
					return res.status(StatusCodes.CONFLICT).end()
				}

				try {
					await core.close()
					console.log(`[canvas-cli] Stopped ${core.uri}`)
					res.status(StatusCodes.OK).end()
				} catch (err) {
					const message = err instanceof Error ? err.message : (err as any).toString()
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message)
				} finally {
					this.cores.delete(name)
				}
			})
		})

		this.api.post("/app/:name/actions", (req, res) => {
			const { name } = req.params

			this.queue.add(async () => {
				const core = this.cores.get(name)
				if (core === undefined) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				await handleAction(core, req, res)
			})
		})

		this.api.post("/app/:name/sessions", (req, res) => {
			const { name } = req.params

			this.queue.add(async () => {
				const core = this.cores.get(name)
				if (core === undefined) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				await handleSession(core, req, res)
			})
		})

		this.api.get("/app/:name/*", (req, res) => {
			const { name } = req.params
			this.queue.add(async () => {
				const core = this.cores.get(name)
				if (core === undefined) {
					return res.status(StatusCodes.NOT_FOUND).end()
				}

				const prefix = `/app/${name}`
				const path = req.path.slice(prefix.length)
				const pathComponents = path === "" || path === "/" ? [] : path.slice(1).split("/")

				await handleRoute(core, pathComponents, req, res)
			})
		})
	}

	public async close() {
		await this.queue.onIdle()
		for (const core of this.cores.values()) {
			await core.close()
		}
	}
}
