import assert from "node:assert"
import express from "express"
import { StatusCodes } from "http-status-codes"
import { AbortError } from "abortable-iterator"
import { anySignal } from "any-signal"
import { Counter, Gauge, Summary, Registry, register } from "prom-client"

import type { PeerId } from "@libp2p/interface"
import { peerIdFromString } from "@libp2p/peer-id"
import * as json from "@ipld/dag-json"

import { Action, Message, Session, Signature } from "@canvas-js/interfaces"

import { Canvas } from "./Canvas.js"

import { PING_TIMEOUT } from "./constants.js"

export interface APIOptions {
	exposeModels?: boolean
	exposeMessages?: boolean
	exposeP2P?: boolean
}

export function createAPI(app: Canvas, options: APIOptions = {}): express.Express {
	const api = express()

	api.set("query parser", "simple")
	api.use(express.json())
	api.use(express.text())

	api.get("/", (req, res) => res.json(app.getApplicationData()))

	if (options.exposeModels) {
		api.get("/models/:model/:key", async (req, res) => {
			const { model, key } = req.params
			if (app.db.models[model] === undefined) {
				return res.status(StatusCodes.NOT_FOUND).end()
			} else {
				const value = await app.db.get(model, key)
				return res.json(value)
			}
		})

		api.get("/models/:model", async (req, res) => {
			// TODO: start/limit/offset
			return res.status(StatusCodes.NOT_IMPLEMENTED).end()
		})
	}

	api.get("/messages/:id", async (req, res) => {
		const { id } = req.params
		const [signature, message] = await app.messageLog.get(id)
		if (signature === null || message === null) {
			return res.status(StatusCodes.NOT_FOUND).end()
		}

		return res.status(StatusCodes.OK).contentType("application/json").end(json.encode({ id, signature, message }))
	})

	api.get("/messages", async (req, res) => {
		const { gt, gte, lt, lte, type } = req.query

		const limit = typeof req.query.limit === "string" ? Math.min(100, parseInt(req.query.limit)) : 100
		assert(Number.isSafeInteger(limit) && limit > 0, "invalid `limit` query parameter")
		assert(type === undefined || type === "action" || type === "session", "invalid `type` query parameter")

		let lowerBound: { id: string; inclusive: boolean } | null = null
		let upperBound: { id: string; inclusive: boolean } | null = null

		if (typeof gte === "string") {
			lowerBound = { id: gte, inclusive: true }
		} else if (typeof gt === "string") {
			lowerBound = { id: gt, inclusive: false }
		}

		if (typeof lt === "string") {
			upperBound = { id: lt, inclusive: false }
		} else if (typeof lte === "string") {
			upperBound = { id: lte, inclusive: true }
		}

		const results: [id: string, signature: Signature, message: Message<Action | Session>][] = []

		for await (const [id, signature, message] of app.getMessages(lowerBound, upperBound)) {
			if (type !== undefined && type !== message.payload.type) {
				continue
			}

			if (results.push([id, signature, message]) >= limit) {
				break
			}
		}

		return res.status(StatusCodes.OK).contentType("application/json").end(json.encode(results))
	})

	api.post("/messages", async (req, res) => {
		let data: string
		if (req.headers["content-type"] === "application/json") {
			data = JSON.stringify(req.body)
		} else {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		try {
			const { signature, message } = json.parse<{ signature: Signature; message: Message }>(data)
			const { id } = await app.insert(signature, message as Message<Action | Session>)
			return res.status(StatusCodes.CREATED).setHeader("Location", `messages/${id}`).end()
		} catch (e) {
			console.error(e)
			return res.status(StatusCodes.BAD_REQUEST).end()
		}
	})

	api.get("/sessions", async (req, res) => {
		const { address, publicKey, minExpiration } = req.query
		assert(typeof address === "string", "missing address query parameter")
		assert(typeof publicKey === "string", "missing publicKey query parameter")

		let minExpirationValue: number | undefined = undefined
		if (typeof minExpiration === "string") {
			minExpirationValue = parseInt(minExpiration)
		}

		const sessions = await app.getSessions({ address, publicKey, minExpiration: minExpirationValue })
		return res.json(sessions)
	})

	api.get("/clock", async (req, res) => {
		const [clock, parents] = await app.messageLog.getClock()
		return res.status(StatusCodes.OK).json({ topic: app.topic, clock, parents })
	})

	if (options.exposeP2P) {
		api.get("/connections", (req, res) => {
			if (app.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const result: Record<string, { peer: string; addr: string; streams: Record<string, string | null> }> = {}

			for (const { id, remotePeer, remoteAddr, streams } of app.libp2p.getConnections()) {
				result[id] = {
					peer: remotePeer.toString(),
					addr: remoteAddr.toString(),
					streams: Object.fromEntries(streams.map((stream) => [stream.id, stream.protocol ?? null])),
				}
			}

			return res.status(StatusCodes.OK).json(result)
		})

		api.get("/peers", (req, res) => {
			if (app.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const peers = app.libp2p.services.pubsub.getPeers()
			res.status(StatusCodes.OK).json(peers.map((peerId) => peerId.toString()))
		})

		api.post("/ping/:peerId", async (req, res) => {
			if (app.libp2p === null) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
				return
			}

			const requestController = new AbortController()
			req.on("close", () => requestController.abort())

			const signal = anySignal([AbortSignal.timeout(PING_TIMEOUT), requestController.signal])

			let peerId: PeerId
			try {
				peerId = peerIdFromString(req.params.peerId)
			} catch (err) {
				return res.status(StatusCodes.BAD_REQUEST).end(`${err}`)
			}

			try {
				const latency = await app.libp2p.services.ping.ping(peerId, { signal })
				res.status(StatusCodes.OK).end(`Got response from ${peerId} in ${latency}ms\n`)
			} catch (err) {
				if (err instanceof AbortError) {
					res.status(StatusCodes.GATEWAY_TIMEOUT).end(err.toString())
				} else {
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(`${err}`)
				}
			} finally {
				signal.clear()
			}
		})
	}

	return api
}

export function createMetricsAPI(app: Canvas): express.Express {
	const canvasRegister = new Registry()

	const canvasMetrics = {
		canvas_messages: new Counter({
			registers: [canvasRegister],
			name: "canvas_messages",
			help: "number of messages processed",
			labelNames: ["topic", "type"],
		}),

		canvas_sync_time: new Summary({
			registers: [canvasRegister],
			name: "canvas_sync_time",
			help: "merkle sync times",
			labelNames: ["topic", "peer"],
			maxAgeSeconds: 60 * 60,
			ageBuckets: 24,
		}),

		canvas_gossipsub_subscribers: new Gauge({
			registers: [canvasRegister],
			name: "canvas_gossipsub_subscribers",
			help: "GossipSub topic subscribers",
			labelNames: ["topic"],
			async collect() {
				if (app.libp2p !== null) {
					const { pubsub } = app.libp2p.services
					for (const topic of pubsub.getTopics() ?? []) {
						const subscribers = pubsub.getSubscribers(topic)
						this.set({ topic }, subscribers.length)
					}
				}
			},
		}),
	}

	app.messageLog.addEventListener("message", ({ detail: { message } }) => {
		canvasMetrics.canvas_messages.inc({ topic: message.topic, type: message.payload.type })
	})

	app.messageLog.addEventListener("sync", ({ detail: { peer, duration } }) => {
		canvasMetrics.canvas_sync_time.observe({ topic: app.messageLog.topic, peer }, duration)
	})

	const api = express()

	api.get("/", async (req, res) => {
		const appMetrics = await canvasRegister.metrics()
		const libp2pMetrics = await register.metrics()
		res.header("Content-Type", register.contentType)
		res.write(appMetrics + "\n")
		res.write(libp2pMetrics + "\n")
		res.end()
	})

	return api
}
