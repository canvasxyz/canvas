import fs from "node:fs"
import http from "node:http"
import assert from "node:assert"

import { fileURLToPath } from "url"
import path, { dirname } from "path"
import { packageDirectorySync } from "pkg-dir"

import chalk from "chalk"
import express from "express"
import cors from "cors"
import { WebSocketServer } from "ws"
import { multiaddr } from "@multiformats/multiaddr"
import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher"
import stoppable from "stoppable"

import { SessionSigner } from "@canvas-js/interfaces"
import { Canvas, PeerId, Snapshot, hashSnapshot, ModelSchema, ContractClass } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"

import { NetworkServer } from "@canvas-js/gossiplog/server"
import { defaultBootstrapList } from "@canvas-js/gossiplog/bootstrap"

import { SIWESigner, Eip712Signer, SIWFSigner } from "@canvas-js/signer-ethereum"
import { ATPSigner } from "@canvas-js/signer-atp"
import { CosmosSigner } from "@canvas-js/signer-cosmos"
import { SubstrateSigner } from "@canvas-js/signer-substrate"
import { SolanaSigner } from "@canvas-js/signer-solana"

const { BOOTSTRAP_LIST } = process.env

export type AppInstanceConfig = {
	/** Base topic to start the app with. If a snapshot is provided, the snapshot hash will also be appended. */
	baseTopic: string

	/** Networking configuration options */
	config: AppConfig

	contract: string | ContractClass | { models: ModelSchema }
	signers?: SessionSigner[]
	snapshot?: Snapshot | null | undefined
	reset?: boolean
	location: string | null
	verbose?: boolean
}

export type AppConfig = {
	/* networking configuration */
	port: number
	offline: boolean
	connect?: string
	listen: string[]
	announce: string[]
	bootstrap?: string[]
	"max-connections": number

	/* service configuration */
	admin?: string
	static?: string
	"network-explorer"?: boolean
	"disable-http-api"?: boolean
}

// A class for launching `Canvas` apps that wraps signers, API setup, and libp2p setup.
export class AppInstance {
	readonly config: AppConfig
	readonly app: Canvas
	readonly verbose?: boolean

	api?: express.Express

	private wss?: WebSocketServer
	private network?: NetworkServer<any>
	private server?: http.Server & stoppable.WithStop

	private closing = false
	private onProgramInterrupt: () => void

	static async initialize({
		baseTopic,
		contract,
		signers,
		snapshot,
		reset,
		location,
		config,
		verbose,
	}: AppInstanceConfig) {
		const topic = snapshot ? `${baseTopic}#${hashSnapshot(snapshot)}` : baseTopic
		AppInstance.printInitialization(topic, location)

		const app = await Canvas.initialize({
			path: process.env.DATABASE_URL ?? location,
			topicOverride: topic,
			contract,
			snapshot,
			signers: signers ?? [
				new SIWESigner({ readOnly: true }),
				new Eip712Signer({ readOnly: true }),
				new SIWFSigner(),
				new ATPSigner(),
				new CosmosSigner(),
				new SubstrateSigner(),
				new SolanaSigner(),
			],
			reset,
		})
		const instance = new AppInstance(app, config, verbose)

		instance.setupLogging()
		await instance.setupNetworking()

		if (!config["disable-http-api"]) {
			await instance.setupHttpAPI()
			await instance.printApiInfo()
		}

		return instance
	}

	constructor(app: Canvas, config: AppConfig, verbose?: boolean) {
		this.config = config
		this.app = app

		this.onProgramInterrupt = () => {
			if (this.closing) {
				process.exit(1)
			} else {
				this.closing = true
				process.stdout.write(
					`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`,
				)

				this.stop().then(() => {
					console.log("[canvas] Closed app instance.")
				})
			}
		}
		process.on("SIGINT", this.onProgramInterrupt)
	}

	public async stop() {
		console.log("[canvas] Closing app instance...")
		await this.app?.stop()
		this.network?.close()
		this.wss?.close()
		this.server?.stop()
		process.removeListener("SIGINT", this.onProgramInterrupt)
	}

	private static printInitialization(topic: string, location: string | null) {
		if (process.env.DATABASE_URL) {
			console.log(`[canvas] Using database at ${process.env.DATABASE_URL}`)
		} else if (location === null) {
			console.log(chalk.yellow(`✦ ${chalk.bold("Running app in-memory only.")} No data will be persisted.`))
			console.log("")
		}
		console.log(`${chalk.gray("[canvas] Starting app with topic")} ${chalk.whiteBright(topic)}`)
	}

	private setupLogging() {
		this.app.addEventListener("message", ({ detail: { id, message } }) => {
			if (this.verbose) {
				console.log(`[canvas] Applied message ${chalk.green(id)}`, message.payload)
			} else {
				console.log(`[canvas] Applied message ${chalk.green(id)}`)
			}
		})

		this.app.addEventListener("sync", ({ detail: { peer, duration, messageCount } }) => {
			console.log(
				chalk.magenta(
					`[canvas] Completed merkle sync with peer ${peer}: applied ${messageCount} messages in ${duration}ms`,
				),
			)
		})
	}

	private async setupNetworking() {
		if (this.config.connect) {
			await this.app.connect(this.config.connect)
		} else if (!this.config.offline) {
			let bootstrapList = defaultBootstrapList
			if (this.config.offline) {
				bootstrapList = []
			} else if (this.config.bootstrap !== undefined) {
				console.log(chalk.yellowBright("[canvas] Using custom bootstrap servers"))
				bootstrapList = []
				for (const address of this.config.bootstrap) {
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
			const libp2p = await this.app.startLibp2p({
				listen: this.config.listen,
				announce: this.config.announce,
				maxConnections: this.config["max-connections"],
				bootstrapList: bootstrapList,
			})

			const id = libp2p.peerId.toString()
			console.log(chalk.gray(`[canvas] Using PeerId ${id}`))

			for (const addr of this.config.listen) {
				console.log(chalk.gray(`[canvas] Listening on ${addr}/p2p/${id}`))
			}

			for (const addr of this.config.announce) {
				console.log(chalk.gray(`[canvas] Announcing on ${addr}/p2p/${id}`))
			}

			this.app.addEventListener("connect", ({ detail: { peer } }) => {
				console.log(chalk.gray(`[canvas] Opened connection to ${peer}`))
			})

			this.app.addEventListener("disconnect", ({ detail: { peer } }) => {
				console.log(chalk.gray(`[canvas] Closed connection to ${peer}`))
			})
		}
	}

	private async setupHttpAPI(): Promise<Express.Application> {
		if (this.api !== undefined) {
			throw new Error("express api already initialized")
		}

		const api = express()
		api.use(cors())
		api.use(express.json())
		api.use("/api", createAPI(this.app))

		this.api = api

		// TODO: add metrics API
		//
		if (this.config.static !== undefined) {
			assert(/^(.\/)?\w[\w-_/]*$/.test(this.config.static), "Invalid directory for static files")
			assert(fs.existsSync(this.config.static), "Invalid directory for static files (path not found)")
			api.use(express.static(this.config.static))
		}

		if (this.config["network-explorer"] !== undefined) {
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
					api.use(this.config.static !== undefined ? "/explorer" : "/", express.static(localBuild))
				} else {
					console.log(
						chalk.yellow(
							"[canvas] [dev] Could not find development build, try `npm run build`. Falling back to installed package...",
						),
					)
					const build = path.resolve(root, "node_modules/@canvas-js/network-explorer/dist")
					assert(fs.existsSync(build), "Invalid directory for network explorer static files (build not found)")
					api.use(this.config.static !== undefined ? "/explorer" : "/", express.static(build))
				}
			} else {
				// called from installed package
				const networkExplorer = path.resolve(packageDirectory, "node_modules/@canvas-js/network-explorer")
				assert(fs.existsSync(networkExplorer), "Could not find network explorer package")
				const build = path.resolve(networkExplorer, "dist")
				assert(fs.existsSync(build), "Invalid directory for network explorer static files (build not found)")
				api.use(this.config.static !== undefined ? "/explorer" : "/", express.static(build))
			}
		}

		this.server = stoppable(http.createServer(api))
		this.network = new NetworkServer(this.app.messageLog)
		this.wss = new WebSocketServer({ server: this.server, perMessageDeflate: false })
		this.wss.on("connection", this.network.handleConnection)

		await new Promise<void>((resolve) => this.server?.listen(this.config.port, resolve))

		console.log("")

		const origin = `http://localhost:${this.config.port}`
		if (this.config.static) {
			console.log(`Serving static bundle: ${chalk.bold(origin)}`)
		}
		if (this.config.static && this.config["network-explorer"]) {
			console.log(`Serving network explorer: ${chalk.bold(origin)}/explorer`)
		} else if (this.config["network-explorer"]) {
			console.log(`Serving network explorer: ${chalk.bold(origin)}`)
			api.get("/explorer", (_req, res) => {
				res.redirect("/")
			})
		}

		return api
	}

	private async printApiInfo() {
		const origin = `http://localhost:${this.config.port}`
		const wsAPI = `ws://localhost:${this.config.port}`

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

		const { models, actions } = await this.app.getApplicationData()
		for (const name of Object.keys(models)) {
			console.log(`└ GET  ${origin}/api/models/${name}`)
			console.log(`└ GET  ${origin}/api/models/${name}/:key`)
		}

		if (this.config.admin !== undefined) {
			console.log(`└ POST ${origin}/api/migrate`)
		}

		console.log("")
		console.log("Actions:")
		for (const action of actions) {
			console.log(`└ ${action}`)
		}

		console.log("")
		console.log("Models:")
		for (const model of Object.keys(models)) {
			console.log(`└ ${model}`)
		}
	}

	private getAnnounceMultiaddrs(config: AppConfig) {
		const announce: string[] = []
		for (const address of config.announce) {
			assert(typeof address === "string", "announce address must be a string")
			const addr = multiaddr(address)
			assert(
				WebSockets.exactMatch(addr) || WebSocketsSecure.exactMatch(addr),
				"announce address must be a /ws or /wss multiaddr",
			)

			announce.push(address)
		}
		return announce
	}

	private getListenMultiaddrs(config: AppConfig) {
		const listen: string[] = []
		for (const address of config.listen) {
			assert(typeof address === "string", "listen address must be a string")
			const addr = multiaddr(address)
			assert(
				WebSockets.exactMatch(addr) || WebSocketsSecure.exactMatch(addr),
				"listen address must be a /ws or /wss multiaddr",
			)

			listen.push(address)
		}
		return listen
	}
}
