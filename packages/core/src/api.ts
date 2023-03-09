import chalk from "chalk"
import express from "express"
import { StatusCodes } from "http-status-codes"

import { register, Counter, Gauge, Summary, Registry } from "prom-client"

import type { Message, ModelValue } from "@canvas-js/interfaces"
import { Core } from "./core.js"
import { ipfsURIPattern, assert } from "./utils.js"

interface Options {
	exposeMetrics: boolean
	exposeModels: boolean
	exposeMessages: boolean
}

export function getAPI(core: Core, options: Partial<Options> = {}): express.Express {
	const coreRegister = new Registry()

	const coreMetrics = {
		canvas_messages: new Counter({
			registers: [coreRegister],
			name: "canvas_messages",
			help: "number of messages applied",
			labelNames: ["type", "uri"],
		}),

		canvas_sync_time: new Summary({
			registers: [coreRegister],
			name: "canvas_sync_time",
			help: "p2p MST sync times",
			labelNames: ["uri", "status", "peer"],
			maxAgeSeconds: 60 * 60,
			ageBuckets: 24,
		}),

		canvas_gossipsub_subscribers: new Gauge({
			registers: [coreRegister],
			name: "canvas_gossipsub_subscribers",
			help: "GossipSub topic subscribers",
			labelNames: ["uri"],
			async collect() {
				if (core.libp2p === null || core.sources === null) {
					return
				}

				for (const uri of Object.keys(core.sources)) {
					const subscribers = core.libp2p.pubsub.getSubscribers(uri)
					this.set({ uri }, subscribers.length)
				}
			},
		}),

		// canvas_sync_peers: new Gauge({
		// 	registers: [coreRegister],
		// 	name: "canvas_sync_peers",
		// 	help: "DHT application peers",
		// 	labelNames: ["uri"],
		// 	async collect() {
		// 		if (core.sources === null) {
		// 			return
		// 		}

		// 		for (const [uri, source] of Object.entries(core.sources)) {
		// 			this.set({ uri })
		// 		}
		// 	},
		// }),
	}

	const api = express()

	api.set("query parser", "simple")
	api.use(express.json())

	api.get("/", async (req, res) => {
		const { routes, actions } = core.vm

		return res.json({
			uri: core.app,
			cid: core.cid.toString(),
			appName: core.appName,
			peerId: core.libp2p && core.libp2p.peerId.toString(),
			models: core.vm.models,
			actions,
			routes: Object.keys(routes),
			merkleRoots: core.messageStore.getMerkleRoots(),
			chainImplementations: core.getChainImplementations(),
			peers: core.libp2p && {
				gossip: Object.fromEntries(core.recentGossipPeers),
				sync: Object.fromEntries(core.recentSyncPeers),
			},
		})
	})

	api.post("/actions", async (req, res) => {
		if (req.headers["content-type"] !== "application/json") {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		try {
			const { hash } = await core.apply(req.body)
			res.json({ hash })
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] Failed to apply action (${err.message})`))
				return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			} else {
				throw err
			}
		}
	})

	api.post("/sessions", async (req, res) => {
		if (req.headers["content-type"] !== "application/json") {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		// if (req.body.hasSession) {
		// 	try {
		// 		const { chain, chainId, hasSession: address } = req.body
		// 		const [_, session] = await core.messageStore.getSessionByAddress(chain, chainId, address)
		// 		return res.json({ hasSession: session !== null })
		// 	} catch (err) {
		// 		return res.json({ hasSession: false })
		// 	}
		// }

		try {
			const { hash } = await core.apply(req.body)
			res.json({ hash })
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] Failed to create session (${err.message})`))
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			} else {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
				throw err
			}
		}
	})

	for (const route of Object.keys(core.vm.routes)) {
		api.get(route, (req, res) => handleRoute(core, route, req, res))
	}

	if (options.exposeMetrics) {
		if (core.sources !== null) {
			for (const [uri, source] of Object.entries(core.sources)) {
				source.addEventListener("sync", ({ detail: { peer, status, time } }) => {
					coreMetrics.canvas_sync_time.observe({ uri, peer, status }, time)
				})
			}
		}

		core.addEventListener("message", ({ detail: message }) => {
			const uri = message.type === "customAction" ? message.app : message.payload.app
			coreMetrics.canvas_messages.inc({ uri, type: message.type })
		})

		api.get("/metrics", async (req, res) => {
			try {
				// const libp2pMetrics = await libp2pRegister.metrics()
				// const canvasMetrics = await canvasRegister.metrics()
				const coreMetrics = await coreRegister.metrics()
				const defaultMetrics = await register.metrics()
				res.header("Content-Type", register.contentType)
				// res.write(libp2pMetrics + "\n")
				// res.write(canvasMetrics + "\n")
				res.write(coreMetrics + "\n")
				res.write(defaultMetrics + "\n")
				res.end()
			} catch (err) {
				if (err instanceof Error) {
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
				} else {
					throw err
				}
			}
		})
	}

	if (options.exposeModels) {
		api.get("/models/:model", async (req, res) => {
			const { model: modelName } = req.params
			const modelNames = core.modelStore.getModelNames()
			if (modelNames.includes(modelName)) {
				const rows: Record<string, ModelValue>[] = []
				const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit) : -1
				for await (const row of core.modelStore.exportModel(modelName, { limit })) {
					rows.push(row)
				}

				return res.status(StatusCodes.OK).json(rows)
			} else {
				return res.status(StatusCodes.NOT_FOUND).end()
			}
		})
	}

	if (options.exposeMessages) {
		api.get("/messages", async (req, res) => {
			const { limit, type, app } = req.query

			const filter: { type?: Message["type"]; limit?: number; app?: string } = {}

			if (typeof type === "string") {
				if (type === "action" || type === "session" || type === "customAction") {
					filter.type = type
				} else {
					res.status(StatusCodes.BAD_REQUEST).end("Invalid type parameter")
					return
				}
			}

			if (typeof limit === "string") {
				filter.limit = parseInt(limit)
				if (isNaN(filter.limit)) {
					res.status(StatusCodes.BAD_REQUEST).end("Invalid limit parameter")
					return
				}
			}

			if (typeof app === "string") {
				if (ipfsURIPattern.test(app)) {
					filter.app = app
				} else {
					res.status(StatusCodes.BAD_REQUEST).end("Invalid app parameter")
					return
				}
			}

			const messages: Message[] = []
			for await (const [_, message] of core.messageStore.getMessageStream(filter)) {
				messages.push(message)
			}

			return res.status(StatusCodes.OK).json(messages)
		})
	}

	return api
}

async function handleRoute(core: Core, route: string, req: express.Request, res: express.Response) {
	const routeParameters = core.vm.routes[route]
	assert(routeParameters !== undefined)

	const params: Record<string, string> = {}
	for (const param of routeParameters) {
		const value = req.params[param]
		assert(value !== undefined, `missing route param ${param}`)
		params[param] = value
	}

	for (const [param, value] of Object.entries(req.query)) {
		if (param in params) {
			continue
		} else if (typeof value === "string") {
			try {
				params[param] = JSON.parse(value)
			} catch (err) {
				return res.status(StatusCodes.BAD_REQUEST).end(`Invalid query param value ${param}=${value}`)
			}
		}
	}

	if (req.headers.accept === "text/event-stream") {
		// subscription response
		res.setHeader("Cache-Control", "no-cache")
		res.setHeader("Content-Type", "text/event-stream")
		res.setHeader("Connection", "keep-alive")
		res.flushHeaders()

		let oldValues: Record<string, ModelValue>[] | null = null
		let closed = false
		const listener = async () => {
			if (closed) {
				return
			}

			let newValues: Record<string, ModelValue>[]
			try {
				newValues = await core.getRoute(route, params)
			} catch (err) {
				closed = true
				if (err instanceof Error) {
					console.log(chalk.red(`[canvas-core] error evaluating route (${err.message})`))
					return res.status(StatusCodes.BAD_REQUEST).end(`Route error: ${err.stack}`)
				} else {
					throw err
				}
			}

			if (oldValues === null || !compareResults(oldValues, newValues)) {
				res.write(`data: ${JSON.stringify(newValues)}\n\n`)
				oldValues = newValues
			}
		}

		listener()
		core.addEventListener("message", listener)
		res.on("close", () => core.removeEventListener("message", listener))
	} else {
		// normal JSON response
		let data
		try {
			data = await core.getRoute(route, params)
		} catch (err) {
			if (err instanceof Error) {
				return res.status(StatusCodes.BAD_REQUEST).end(`Route error: ${err.stack}`)
			} else {
				throw err
			}
		}

		return res.json(data)
	}
}

export function compareResults(a: Record<string, ModelValue>[], b: Record<string, ModelValue>[]) {
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
