import assert from "node:assert"
import express from "express"
import ipld from "express-ipld"
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

	api.get("/", (req, res) => void res.json(app.getApplicationData()))

	if (options.exposeModels) {
		api.get("/models/:model/:key", async (req, res) => {
			const { model, key } = req.params
			if (app.db.models[model] === undefined) {
				return void res.status(StatusCodes.NOT_FOUND).end()
			} else {
				const value = await app.db.get(model, key)

				res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
				return void res.end(json.encode(value))
			}
		})

		api.get("/models/:model", async (req, res) => {
			// TODO: start/limit/offset
			return void res.status(StatusCodes.NOT_IMPLEMENTED).end()
		})
	}

	api.get("/messages/:id", async (req, res) => {
		const { id } = req.params
		const [signature, message] = await app.getMessage(id)
		if (signature === null || message === null) {
			return void res.status(StatusCodes.NOT_FOUND).end()
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode({ id, signature, message }))
	})

	api.get("/messages", async (req, res) => {
		const { gt, gte, lt, lte, order, type } = req.query

		assert(gt === undefined || typeof gt === "string", "invalid `gt` query parameter")
		assert(gte === undefined || typeof gte === "string", "invalid `gte` query parameter")
		assert(lt === undefined || typeof lt === "string", "invalid `lt` query parameter")
		assert(lte === undefined || typeof lte === "string", "invalid `lte` query parameter")

		let limit = 64
		if (typeof req.query.limit === "string") {
			limit = parseInt(req.query.limit)
		}

		assert(Number.isSafeInteger(limit) && 0 < limit && limit <= 64, "invalid `limit` query parameter")

		// TODO: add `type` back
		// assert(type === undefined || type === "action" || type === "session", "invalid `type` query parameter")
		assert(order === undefined || order === "asc" || order === "desc", "invalid `order` query parameter")

		const reverse = order === "desc"

		const results: [id: string, signature: Signature, message: Message<Action | Session>][] = []

		for (const { id, signature, message } of await app.messageLog.getMessages({ gt, gte, lt, lte, reverse, limit })) {
			results.push([id, signature, message])
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode(results))
	})

	api.post("/messages", ipld(), async (req, res) => {
		try {
			const { signature, message }: { signature: Signature; message: Message<Action | Session> } = req.body
			const { id } = await app.insert(signature, message)
			res.status(StatusCodes.CREATED)
			res.setHeader("Location", `messages/${id}`)
			return void res.end()
		} catch (e) {
			console.error(e)
			return void res.status(StatusCodes.BAD_REQUEST).end(`${e}`)
		}
	})

	api.get("/sessions", async (req, res) => {
		const { did, publicKey, minExpiration } = req.query
		if (typeof did !== "string") {
			return void res.status(StatusCodes.BAD_REQUEST).end("missing did query parameter")
		} else if (typeof publicKey !== "string") {
			return void res.status(StatusCodes.BAD_REQUEST).end("missing publicKey query parameter")
		}

		let minExpirationValue: number | undefined = undefined
		if (typeof minExpiration === "string") {
			minExpirationValue = parseInt(minExpiration)
		}

		const sessions = await app.getSessions({ did, publicKey, minExpiration: minExpirationValue })
		return void res.json(sessions)
	})

	api.get("/clock", async (req, res) => {
		const [clock, parents] = await app.messageLog.getClock()
		return void res.json({ clock, parents })
	})

	if (options.exposeP2P) {
		const meshPeers = new Set<string>()
		app.messageLog.addEventListener("graft", ({ detail: { peerId } }) => meshPeers.add(peerId))
		app.messageLog.addEventListener("prune", ({ detail: { peerId } }) => meshPeers.delete(peerId))

		api.get("/connections", (req, res) => {
			const results: {
				id: string
				remotePeer: string
				remoteAddr: string
				streams: { id: string; protocol: string | null }[]
			}[] = []

			for (const { id, remotePeer, remoteAddr, streams } of app.libp2p.getConnections()) {
				results.push({
					id,
					remotePeer: remotePeer.toString(),
					remoteAddr: remoteAddr.toString(),
					streams: streams.map(({ id, protocol }) => ({ id, protocol: protocol ?? null })),
				})
			}

			return void res.json(results)
		})

		api.get("/mesh/:topic", (req, res) => {
			if (req.params.topic === app.topic) {
				return void res.json(Array.from(meshPeers))
			} else {
				return void res.status(StatusCodes.NOT_FOUND).end()
			}
		})

		api.post("/ping/:peerId", async (req, res) => {
			if (app.libp2p === null) {
				return void res.status(StatusCodes.INTERNAL_SERVER_ERROR).end("Offline")
			}

			const requestController = new AbortController()
			req.on("close", () => requestController.abort())

			const signal = anySignal([AbortSignal.timeout(PING_TIMEOUT), requestController.signal])

			let peerId: PeerId
			try {
				peerId = peerIdFromString(req.params.peerId)
			} catch (err) {
				return void res.status(StatusCodes.BAD_REQUEST).end(`${err}`)
			}

			try {
				const latency = await app.libp2p.services.ping.ping(peerId, { signal })
				return void res.status(StatusCodes.OK).end(`Got response from ${peerId} in ${latency}ms\n`)
			} catch (err) {
				if (err instanceof AbortError) {
					return void res.status(StatusCodes.GATEWAY_TIMEOUT).end(err.toString())
				} else {
					return void res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(`${err}`)
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
					for (const topic of pubsub?.getTopics() ?? []) {
						const subscribers = pubsub?.getSubscribers(topic) ?? []
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
		return void res.end()
	})

	return api
}
