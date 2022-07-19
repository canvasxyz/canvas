import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"
import process from "node:process"
import stoppable from "stoppable"

import { getQuickJS } from "quickjs-emscripten"
import ethers from "ethers"
import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"
import chalk from "chalk"
import * as t from "io-ts"

import { Core, actionType, actionPayloadType, sessionType } from "@canvas-js/core"
import { create as createIpfsHttpClient } from "ipfs-http-client"

import { defaultDataDirectory, deleteActionLog, deleteModelDatabase, locateSpec } from "../utils.js"

export const command = "run <spec>"
export const desc = "Run an app, by path or IPFS hash"

export const builder = (yargs) => {
	yargs
		.positional("spec", {
			describe: "Path to spec file, or IPFS hash of spec",
			type: "string",
			demandOption: true,
		})
		.option("datadir", {
			type: "string",
			desc: "Path of the app data directory",
			default: defaultDataDirectory,
		})
		.option("port", {
			type: "number",
			desc: "Port to bind the core API",
			default: 8000,
		})
		.option("peering", {
			type: "boolean",
			desc: "Enable peering over IPFS PubSub",
		})
		.option("ipfs", {
			type: "string",
			desc: "IPFS HTTP API URL",
			default: "http://localhost:5001",
		})
		.option("noserver", {
			type: "boolean",
			desc: "Don't bind an Express server to provide view APIs",
		})
		// .option("fixtures", {
		// 	type: "string",
		// 	desc: "Path to a JSON file containing an array of action payloads",
		// })
		.option("reset", {
			type: "boolean",
			desc: "Reset the action log and model database",
		})
		.option("replay", {
			type: "boolean",
			desc: "Reconstruct the model database by replying the action log",
		})
		.option("watch", {
			type: "boolean",
			desc: "Restart the core on spec file changes",
		})
		.option("temp", {
			type: "boolean",
			desc: "Open a temporary in-memory core",
		})
		.option("eth-chain", {
			type: "array",
			desc: "Provide an RPC endpoint for Ethereum-compatible chains",
		})
}

export async function handler(args) {
	// validate options
	if (args.replay && args.reset) {
		console.error(chalk.red("[canvas-cli] --replay and --reset cannot be used together"))
		process.exit(1)
	}

	if (args.temp && (args.replay || args.reset)) {
		console.error(chalk.red("[canvas-cli] --temp cannot be used with --replay or --reset"))
		process.exit(1)
	}

	const { specPath, directory, name, spec, development } = await locateSpec(args)

	if (development && args.peering) {
		console.error(chalk.red(`[canvas-cli] --peering cannot be enabled for local development specs`))
		process.exit(1)
	}

	if (args.watch && !development) {
		console.warn(chalk.yellow(`[canvas-cli] --watch has no effect on CID specs`))
	}

	if (!args.temp) {
		if (!fs.existsSync(directory)) {
			console.log(`[canvas-cli] Creating directory ${directory}`)
			fs.mkdirSync(directory)
		} else if (args.reset) {
			await deleteActionLog(directory, { prompt: true })
		} else if (args.replay) {
			await deleteModelDatabase(directory, { prompt: true })
		}
	}

	let ethRpcs = {}
	if (args.ethChain) {
		for (let i = 0; i < args.ethChain.length; i += 2) {
			const chainId = args.ethChain[i]
			const chainRpc = args.ethChain[i + 1]
			if (typeof chainId !== "number") {
				console.error("Invalid chainId for ethereum-compatible chain:", chainId)
				return
			}
			if (typeof chainRpc !== "string") {
				console.error("Invalid rpc url for ethereum-compatible chain:", chainRpc)
				return
			}
			ethRpcs[chainId] = chainRpc
		}
	}

	const quickJS = await getQuickJS()
	let ipfs, peerId
	if (args.peering) {
		ipfs = createIpfsHttpClient({ url: args.ipfs })
		const { id } = await ipfs.id()
		peerId = id.toString()
		console.log("[canvas-cli] Got local PeerID", peerId)
	}

	let core, api
	try {
		core = await Core.initialize({
			name,
			spec,
			directory,
			quickJS,
			replay: args.replay,
			development,
			rpc: { eth: ethRpcs },
		})
		if (!args.noserver) {
			api = new API({ peerId, core, port: args.port, ipfs, peering: args.peering })
		}
	} catch (err) {
		console.log(err)
		// don't terminate on error
	}

	// TODO: intercept SIGINT and shut down the server and core gracefully

	if (!args.watch) {
		return
	}

	if (args.reset) {
		console.log(
			chalk.yellow(
				"[canvas-cli] Warning: the action log will be erased on every change to the spec file. All data will be lost."
			)
		)
	} else if (args.replay) {
		console.log(
			chalk.yellow(
				"[canvas-cli] Warning: the model database will be rebuilt from the action log on every change to the spec file."
			)
		)
	}

	let terminating = false
	let oldSpec = spec
	fs.watch(specPath, async (event, filename) => {
		if (terminating || !filename || event !== "change") {
			return
		}

		const newSpec = fs.readFileSync(specPath, "utf-8")
		if (newSpec !== oldSpec) {
			console.log("[canvas-cli] File changed, restarting core...\n")
			oldSpec = newSpec
			terminating = true
			try {
				if (!args.noserver) {
					await api?.stop()
				}
				await core.close()
			} catch (err) {
				// continue if the api or core crashed during the last reload
			}

			if (directory !== null) {
				if (args.reset) {
					await deleteActionLog(directory, { prompt: false })
				} else if (args.replay) {
					await deleteModelDatabase(directory, { prompt: false })
				}
			}

			try {
				core = await Core.initialize({ name, spec: newSpec, directory, quickJS, replay: args.replay, development })
				if (!args.noserver) {
					api = new API({ core, port: args.port, ipfs, peering: args.peering })
				}
			} catch (err) {
				console.log(err)
				// don't terminate on error
			}
			terminating = false
		}
	})
}

class API {
	constructor({ peerId, core, port, ipfs, peering }) {
		this.core = core
		this.ipfs = ipfs
		this.peering = peering

		if (peering) {
			this.topic = `canvas:${core.name}`
			this.peerId = peerId
			console.log(`[canvas-cli] Subscribing to pubsub topic ${this.topic}`)
			this.ipfs.pubsub
				.subscribe(this.topic, this.handleMessage)
				.catch((err) => console.error("Failed to subscribe to pubsub topic:", err))
		}

		const api = express()
		api.use(cors({ exposedHeaders: ["ETag"] }))
		api.use(bodyParser.json())

		api.head("/", (req, res) => {
			res.status(StatusCodes.OK)
			res.header("ETag", `"${core.name}"`)
			res.header("Content-Type", "application/json")
			res.end()
		})

		api.get("/", (req, res) => {
			res.header("ETag", `"${core.name}"`)
			res.json({ name: core.name })
		})

		api.post("/actions", this.handleAction)
		api.post("/sessions", this.handleSession)

		for (const route of Object.keys(core.routeParameters)) {
			api.get(route, this.handleRoute(route))
		}

		this.server = stoppable(
			api.listen(port, () => {
				console.log(`[canvas-cli] Serving ${core.name} on port ${port}:`)
				console.log(`└ GET http://localhost:${port}/`)
				for (const name of Object.keys(core.routeParameters)) {
					console.log(`└ GET http://localhost:${port}${name}`)
				}
				console.log("└ POST /actions")
				console.log(`  └ { ${Object.keys(actionType.props).join(", ")} }`)
				console.log(`  └ payload: { ${Object.keys(actionPayloadType.props).join(", ")} }`)
				console.log(`  └ calls: [ ${Object.keys(core.actionParameters).join(", ")} ]`)
				console.log("└ POST /sessions")
				console.log(`  └ { ${Object.keys(sessionType.props).join(", ")} }`)
				console.log(`  └ payload: { ${Object.keys(sessionType.props.payload.props).join(", ")} }`)
			}),
			0
		)
	}

	async stop() {
		if (this.peering) {
			console.log(`[canvas-cli] Unsubscribing from pubsub topic ${this.topic}`)
			await this.ipfs.pubsub
				.unsubscribe(this.topic, this.handleMessage)
				.catch((err) => console.error("[canvas-cli] Error while unsubscribing from pubsub topic", err))
		}

		await new Promise((resolve, reject) => {
			this.server.stop((err) => (err ? reject(err) : resolve()))
		})
	}

	handleRoute = (route) => async (req, res) => {
		const values = {}
		for (const name of this.core.routeParameters[route]) {
			const value = req.params[name]
			if (typeof value === "string") {
				values[name] = value
			} else {
				res.status(StatusCodes.BAD_REQUEST)
				res.end(`Missing parameter "${name}"`)
				return
			}
		}

		if (req.headers.accept === "text/event-stream") {
			// subscription response
			res.setHeader("Cache-Control", "no-cache")
			res.setHeader("Content-Type", "text/event-stream")
			res.setHeader("Access-Control-Allow-Origin", "*")
			res.setHeader("Connection", "keep-alive")
			res.flushHeaders()

			let data = null
			const listener = () => {
				const newData = this.core.getRoute(route, values)
				if (data === null || !compareResults(data, newData)) {
					data = newData
					res.write(`data: ${JSON.stringify(data)}\n\n`)
				}
			}

			try {
				listener()
			} catch (err) {
				// kill the EventSource if this.core.getRoute() fails on first request
				// TODO: is it possible that it succeeds now, but fails later with new `values`?
				res.status(StatusCodes.BAD_REQUEST)
				res.end(`Route error: ${err}`)
				return
			}

			this.core.addEventListener("action", listener)
			res.on("close", () => this.core.removeEventListener("action", listener))
		} else {
			// normal JSON response
			const data = this.core.getRoute(route, values)
			res.status(StatusCodes.OK).json(data)
		}
	}

	handleAction = async (req, res) => {
		const action = req.body
		if (!actionType.is(action)) {
			console.error(`[canvas-cli] Received invalid action`)
			res.status(StatusCodes.BAD_REQUEST).end()
			return
		}

		await this.core
			.apply(action)
			.then(async ({ hash }) => {
				if (this.peering) {
					const messages = []

					if (action.session !== null) {
						const sessionKey = Core.getSessionKey(action.session)
						const sessionRecord = await this.core.hyperbee.get(sessionKey)
						if (sessionRecord !== null) {
							const session = JSON.parse(sessionRecord.value)
							messages.push({ type: "session", ...session })
						}
					}

					messages.push({ type: "action", ...action })
					const data = new TextEncoder().encode(JSON.stringify(messages))
					await this.ipfs.pubsub.publish(this.topic, data).catch((err) => {
						console.error("[canvas-cli] Failed to publish action to pubsub topic:", err)
					})
				}

				res.status(StatusCodes.OK).header("ETag", `"${hash}"`).end()
			})
			.catch((err) => {
				console.error("[canvas-cli] Failed to apply action:", err)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			})
	}

	handleSession = async (req, res) => {
		const session = req.body
		if (!sessionType.is(session)) {
			console.error(`[canvas-cli] Received invalid session`)
			res.status(StatusCodes.BAD_REQUEST).end()
			return
		}

		await this.core
			.session(session)
			.then(async () => {
				if (this.peering) {
					const messages = [{ type: "session", ...session }]
					const data = new TextEncoder().encode(JSON.stringify(messages))
					await this.ipfs.pubsub.publish(this.topic, data).catch((err) => {
						console.error("[canvas-cli] Failed to publish session to pubsub topic:", err)
					})
				}
				res.status(StatusCodes.OK).end()
			})
			.catch((err) => {
				console.error("[canvas-cli] Failed to create session:", err)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			})
	}

	static messagesType = t.array(
		t.union([
			t.intersection([t.type({ type: t.literal("action") }), actionType]),
			t.intersection([t.type({ type: t.literal("session") }), sessionType]),
		])
	)

	handleMessage = (event) => {
		if (event.from.toString() === this.peerId) {
			return
		}

		let messages
		try {
			const data = new TextDecoder().decode(event.data)
			messages = JSON.parse(data)
		} catch (err) {
			console.error("[canvas-cli] Failed to parse pubsub message:", err)
			return
		}

		if (API.messagesType.is(messages)) {
			for (const message of messages) {
				// we don't need to await these here because core uses an async queue internally
				if (message.type === "action") {
					this.core.apply(message).catch((err) => console.error("[canvas-cli] Error applying peer action:", err))
				} else if (message.type === "session") {
					this.core.session(message).catch((err) => console.error("[canvas-cli] Error applying peer session:", err))
				}
			}
		}
	}
}

function compareResults(a, b) {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		for (const key in a[i]) {
			if (a[i][key] !== b[i][key]) {
				return false
			}
		}

		for (const key in b[i]) {
			if (b[i][key] !== a[i][key]) {
				return false
			}
		}
	}
}

// const fixturesType = t.array(
// 	t.type({
// 		privateKey: t.string,
// 		call: t.string,
// 		args: t.array(t.union([t.null, t.number, t.string, t.boolean])),
// 	})
// )

// async function applyFixtures(core, fixtures) {
// 	if (core.feed.length > 0) {
// 		console.error(
// 			chalk.red(
// 				`[canvas-cli]: Found an existing action log in the app directory. Fixtures can only be applied to an empty action log. Re-run in combination with the --reset flag to clear the data in the app directory.`
// 			)
// 		)

// 		await core.close()
// 		process.exit(1)
// 	}

// 	const data = JSON.parse(fs.readFileSync(fixtures, "utf-8"))
// 	if (!fixturesType.is(data)) {
// 		throw new Error("Invalid fixtures file")
// 	}

// 	const timestamp = Date.now()
// 	const wallets = new Map()
// 	for (const [i, { privateKey, call, args }] of data.entries()) {
// 		if (!wallets.has(privateKey)) {
// 			assert(privateKey.startsWith("0x"))
// 			const paddedPrivateKey = "0x" + privateKey.slice(2).padStart(64, "0")
// 			const wallet = new ethers.Wallet(paddedPrivateKey)
// 			wallets.set(privateKey, wallet)
// 		}

// 		const signer = wallets.get(privateKey)
// 		const from = await signer.getAddress()
// 		const payload = {
// 			from,
// 			spec: core.name,
// 			call,
// 			args,
// 			timestamp: timestamp - result.right.length + i,
// 		}

// 		const signatureData = getActionSignatureData(payload)
// 		const signature = await signer._signTypedData(...signatureData)
// 		await core.apply({ session: null, signature, payload })
// 	}
// }

// This assumes a and b are both arrays of objects of primitives,
// ie both Record<string, ModelValue>[]
