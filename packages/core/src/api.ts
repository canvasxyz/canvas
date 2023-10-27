import assert from "node:assert"
import express from "express"
import { StatusCodes } from "http-status-codes"
import { logger } from "@libp2p/logger"
import * as json from "@ipld/dag-json"
import * as cbor from "@ipld/dag-cbor"

import { peerIdFromString } from "@libp2p/peer-id"

import { register, Counter, Gauge, Summary, Registry } from "prom-client"

import { Action, Message, Session } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { Canvas } from "./Canvas.js"

import { getErrorMessage } from "./utils.js"

export interface APIOptions {
	exposeMetrics?: boolean
	exposeModels?: boolean
	exposeMessages?: boolean
	exposeP2P?: boolean
}

export function createAPI(core: Canvas, options: APIOptions = {}): express.Express {
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
	api.use(express.raw({ type: "application/cbor" }))

	api.get("/", async (req, res) => res.json(core.getApplicationData()))

	if (options.exposeMetrics) {
		// core.addEventListener("message", ({ detail: { id, message } }) => {
		// 	coreMetrics.canvas_messages.inc({ id, type: message.type })
		// })

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
			return res.status(StatusCodes.NOT_IMPLEMENTED).end()

			// const { model: modelName } = req.params
			// const models = core.db.models || {}
			// if (modelName in models) {
			// 	const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset) : 0
			// 	const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit) : -1

			// 	const rows = await core.db.query(modelName, {
			// 		// what is the default ordering? does this matter so long as the result is stable
			// 		offset,
			// 		limit,
			// 	})

			// 	const total = await core.db.count(modelName)

			// 	return res.status(StatusCodes.OK).json({
			// 		offset,
			// 		limit,
			// 		total,
			// 		data: rows,
			// 	})
			// } else {
			// 	return res.status(StatusCodes.NOT_FOUND).end()
			// }
		})
	}

	// TODO: replace this with ApplicationData
	api.get("/topics", async (req, res) => {
		return res.status(StatusCodes.OK).json({
			data: [core.topic],
		})
	})

	api.get("/messages", async (req, res) => {
		const { gt, gte, lt, lte } = req.query
		const limit = typeof req.query.limit === "string" ? Math.min(100, parseInt(req.query.limit)) : 100
		assert(Number.isSafeInteger(limit) && limit > 0, "invalid `limit` query parameter")

		const lowerBound =
			typeof gt === "string"
				? { id: gt, inclusive: false }
				: typeof gte === "string"
				? { id: gte, inclusive: true }
				: null

		const upperBound =
			typeof lt === "string"
				? { id: lt, inclusive: false }
				: typeof lte === "string"
				? { id: lte, inclusive: true }
				: null

		const results: { id: string; signature: Signature; message: Message }[] = []
		for await (const [id, signature, message] of core.getMessageStream(lowerBound, upperBound)) {
			if (results.push({ id, signature, message }) >= limit) {
				break
			}
		}

		return res.status(StatusCodes.OK).json(results)
	})

	api.get("/clock", async (req, res) => {
		const [clock, parents] = await core.messageLog.getClock()
		return res.status(StatusCodes.OK).json({ clock, parents })
	})

	api.post("/messages", async (req, res) => {
		let data: Uint8Array | null = null
		if (req.headers["content-type"] === "application/json") {
			data = cbor.encode(json.parse(JSON.stringify(req.body)))
		} else if (req.headers["content-type"] === "application/cbor") {
			data = req.body
		} else {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		assert(data !== null)

		try {
			const [id, signature, message] = core.messageLog.decode(data)
			await core.insert(signature, message as Message<Action | Session>)
			return res.status(StatusCodes.OK).json({ id })
		} catch (e) {
			console.error(e)
			return res.status(StatusCodes.BAD_REQUEST).end()
		}
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

		api.get("/p2p/pubsub/topics", (req, res) => {
			if (core.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			res.status(StatusCodes.OK).json(core.libp2p.services.pubsub.getTopics())
		})

		api.get("/p2p/pubsub/subscribers", (req, res) => {
			if (core.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const { topic } = req.query
			if (typeof topic !== "string") {
				res.status(StatusCodes.BAD_REQUEST).end(`missing topic query param`)
			} else {
				res.status(StatusCodes.OK).json(core.libp2p.services.pubsub.getSubscribers(topic))
			}
		})

		api.get("/p2p/pubsub/peers", (req, res) => {
			if (core.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const peers = core.libp2p.services.pubsub.getPeers()
			res.status(StatusCodes.OK).json(peers.map((peerId) => peerId.toString()))
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
