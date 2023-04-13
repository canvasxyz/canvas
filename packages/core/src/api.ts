import chalk from "chalk"
import express, { Request, Response } from "express"
import { StatusCodes } from "http-status-codes"
import { WebSocket } from "ws"
import { nanoid } from "nanoid"
import { CustomEvent } from "@libp2p/interfaces/events"

import { register, Counter, Gauge, Summary, Registry } from "prom-client"

import type { CoreEvents, Message, ModelValue } from "@canvas-js/interfaces"

import { Core } from "./core.js"
import { ipfsURIPattern, assert, fromHex } from "./utils.js"

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
	}

	const api = express()

	api.set("query parser", "simple")
	api.use(express.json())

	api.get("/", async (req, res) => {
		const data = await core.getApplicationData()
		return res.json(data)
	})

	async function applyMessage(req: Request, res: Response) {
		if (req.headers["content-type"] !== "application/json") {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		try {
			const { hash } = await core.apply(req.body)
			res.json({ hash })
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] Failed to apply message (${err.message})`))
				return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			} else {
				throw err
			}
		}
	}

	api.post("/", applyMessage)
	api.post("/actions", applyMessage)
	api.post("/sessions", applyMessage)

	for (const route of core.vm.getRoutes()) {
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

		core.addEventListener("message", ({ detail: { uri, message } }) => {
			coreMetrics.canvas_messages.inc({ uri, type: message.type })
		})

		api.get("/metrics", async (req, res) => {
			try {
				const coreMetrics = await coreRegister.metrics()
				const defaultMetrics = await register.metrics()
				res.header("Content-Type", register.contentType)
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
			if (modelName in core.vm.getModels()) {
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

		api.get("/messages/:id", async (req, res) => {
			let id: Uint8Array
			try {
				id = fromHex(req.params.id)
			} catch (err) {
				res.status(StatusCodes.BAD_REQUEST).end("Invalid id parameter")
				return
			}

			let message: Message | null
			try {
				message = await core.messageStore.read((txn) => txn.getMessage(id))
			} catch (err) {
				if (err instanceof Error) {
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
				} else {
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
				}
				return
			}

			if (message === null) {
				res.status(StatusCodes.NOT_FOUND).end()
			} else {
				res.json(message)
			}
		})
	}

	return api
}

async function handleRoute(core: Core, route: string, req: express.Request, res: express.Response) {
	const params: Record<string, string> = {}
	for (const param of core.vm.getRouteParameters(route)) {
		const value = req.params[param]
		assert(value !== undefined, `missing route param ${param}`)
		params[param] = value
	}

	for (const [param, value] of Object.entries(req.query)) {
		if (param in params || typeof value !== "string") {
			continue
		}

		try {
			params[param] = JSON.parse(value)
		} catch (err) {
			return res.status(StatusCodes.BAD_REQUEST).end(`Invalid query param value ${param}=${value}`)
		}
	}

	try {
		const data = await core.getRoute(route, params)
		res.json(data)
	} catch (err) {
		if (err instanceof Error) {
			return res.status(StatusCodes.BAD_REQUEST).end(`Route error: ${err.message} ${err.stack}`)
		} else {
			return res.status(StatusCodes.BAD_REQUEST).end()
		}
	}
}

const WS_KEEPALIVE = 30000
const WS_KEEPALIVE_LATENCY = 3000

export function handleWebsocketConnection(core: Core, socket: WebSocket) {
	const id = nanoid(8)
	if (core.options.verbose) {
		console.log(chalk.gray(`[canvas-core] [ws-${id}] Opened socket`))
	}

	let lastPing = Date.now()

	const timer = setInterval(() => {
		if (lastPing < Date.now() - (WS_KEEPALIVE + WS_KEEPALIVE_LATENCY)) {
			console.log(chalk.red(`[canvas-core] [ws-${id}] Closed socket on timeout`))
			socket.close()
		}
	}, WS_KEEPALIVE)

	const closeListener = () => socket.close()
	core.addEventListener("close", closeListener)

	const eventListener = <T>(event: CustomEvent<T> | Event) => {
		console.log(chalk.gray(`[canvas-core] [ws-${id}] Sent ${event.type} event`))
		if (event instanceof CustomEvent) {
			socket.send(JSON.stringify({ type: event.type, detail: event.detail }))
		} else {
			socket.send(JSON.stringify({ type: event.type }))
		}
	}

	const eventTypes: (keyof CoreEvents)[] = ["update", "sync", "connect", "disconnect"]
	for (const type of eventTypes) {
		core.addEventListener(type, eventListener)
	}

	const unsubscribe = () => {
		core.removeEventListener("close", closeListener)
		for (const type of eventTypes) {
			core.removeEventListener(type, eventListener)
		}
	}

	socket.on("close", () => {
		if (core.options.verbose) {
			console.log(chalk.gray(`[canvas-core] [ws-${id}] Closed socket`))
		}

		clearInterval(timer)
		unsubscribe()
	})

	socket.on("message", (data) => {
		if (Buffer.isBuffer(data) && data.toString() === "ping") {
			lastPing = Date.now()
			socket.send("pong")
		} else {
			console.log(chalk.red(`[canvas-core] [ws-${id}] Received invalid message ${data}`))
		}
	})
}
