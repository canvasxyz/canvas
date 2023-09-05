import express, { Request, Response } from "express"
import { StatusCodes } from "http-status-codes"
import { WebSocket } from "ws"
import { nanoid } from "nanoid"
import { CustomEvent } from "@libp2p/interfaces/events"

import { peerIdFromString } from "@libp2p/peer-id"

import { register, Counter, Gauge, Summary, Registry } from "prom-client"

import { Canvas, CoreEvents } from "./Canvas.js"

import { getErrorMessage } from "./utils.js"
import { logger } from "@libp2p/logger"
import { Message } from "@canvas-js/interfaces"

interface Options {
	exposeMetrics: boolean
	exposeModels: boolean
	exposeMessages: boolean
	exposeP2P: boolean
}

export function getAPI(core: Canvas, options: Partial<Options> = {}): express.Express {
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
			labelNames: ["topic"],
			async collect() {
				if (core.libp2p !== null) {
					const { pubsub } = core.libp2p.services
					for (const topic of pubsub.getTopics() ?? []) {
						const subscribers = pubsub.getSubscribers(topic)
						this.set({ topic }, subscribers.length)
					}
				}
			},
		}),
	}

	const log = logger("canvas:api")

	const api = express()

	api.set("query parser", "simple")
	api.use(express.json())
	api.use(express.text())

	api.get("/", async (req, res) => {
		const data = await core.getApplicationData()
		return res.json(data)
	})

	async function applyMessage(req: Request, res: Response) {
		if (req.headers["content-type"] !== "application/json") {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		try {
			// TODO: replace with the new core action API
			// const { hash } = await core.apply(req.body)
			// res.json({ hash })
		} catch (err) {
			if (err instanceof Error) {
				log.error(`Failed to apply message (${err.message})`)
				return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			} else {
				throw err
			}
		}
	}

	api.post("/", applyMessage)

	if (options.exposeMetrics) {
		// TODO: What is "message" used for?
		// @ts-ignore
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
			const models = core.db.models || {}
			if (modelName in models) {
				const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset) : 0
				const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit) : -1

				const rows = await core.db.query(modelName, {
					// what is the default ordering? does this matter so long as the result is stable
					offset,
					limit,
				})

				const total = await core.db.count(modelName)

				return res.status(StatusCodes.OK).json({
					offset,
					limit,
					total,
					data: rows,
				})
			} else {
				return res.status(StatusCodes.NOT_FOUND).end()
			}
		})
	}

	api.get("/topics", async (req, res) => {
		const { gossiplog } = core.libp2p.services

		return res.status(StatusCodes.OK).json({
			data: gossiplog.getTopics().sort(),
		})
	})

	// TODO: implement this
	api.get("/messages/:topic", async (req, res) => {
		const { gossiplog } = core.libp2p.services

		const messages: Message[] = []
		for await (const [id, signature, message] of gossiplog.iterate(req.params.topic, null, null, {})) {
			messages.push(message)
		}

		return res.status(StatusCodes.OK).json({
			offset: 0,
			limit: 0,
			total: messages.length,
			data: messages,
		})
	})

	if (options.exposeP2P) {
		log("Exposing internal p2p API. This can be abused if made publicly accessible.")

		api.get("/p2p/mesh", (req, res) => {
			if (core.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const { pubsub } = core.libp2p.services
			res.json({
				peers: pubsub.getPeers(),
				subscribers: Object.fromEntries(pubsub.getTopics().map((topic) => [topic, pubsub.getSubscribers(topic)])),
			})
		})

		api.get("/p2p/connections", (req, res) => {
			if (core.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const connections = core.libp2p.getConnections()
			const response = Object.fromEntries(
				connections.map(({ id, remotePeer, remoteAddr }) => [
					id,
					{ peerId: remotePeer.toString(), address: remoteAddr.toString() },
				])
			)

			res.status(StatusCodes.OK).json(response)
		})

		api.post("/p2p/ping/:peerId", async (req, res) => {
			if (core.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const { pingService } = core.libp2p.services
			try {
				const peerId = peerIdFromString(req.params.peerId)
				const latency = await pingService.ping(peerId)
				res.status(StatusCodes.OK).end(`${latency}\n`)
			} catch (err) {
				const msg = getErrorMessage(err)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(`${msg}\n`)
			}
		})
	}

	return api
}

const WS_KEEPALIVE = 30000
const WS_KEEPALIVE_LATENCY = 3000

export function handleWebsocketConnection(core: Canvas, socket: WebSocket, options: { verbose?: boolean } = {}) {
	const id = nanoid(8)

	const log = logger("canvas:api")

	log.trace("[ws-${id}] Opened socket`")

	let lastPing = Date.now()

	const timer = setInterval(() => {
		if (lastPing < Date.now() - (WS_KEEPALIVE + WS_KEEPALIVE_LATENCY)) {
			log.error(`[ws-${id}] Closed socket on timeout`)
			socket.close()
		}
	}, WS_KEEPALIVE)

	const closeListener = () => socket.close()
	core.addEventListener("close", closeListener)

	const eventListener = <T>(event: CustomEvent<T> | Event) => {
		log.trace(`[ws-${id}] Sent ${event.type} event`)
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
		log.trace(`[ws-${id}] Closed socket`)

		clearInterval(timer)
		unsubscribe()
	})

	socket.on("message", (data) => {
		if (Buffer.isBuffer(data) && data.toString() === "ping") {
			lastPing = Date.now()
			socket.send("pong")
		} else {
			log.error(`[ws-${id}] Received invalid message ${data}`)
		}
	})
}
