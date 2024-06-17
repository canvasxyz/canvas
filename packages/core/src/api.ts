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
import { GossipSub } from "@chainsafe/libp2p-gossipsub"

export interface APIOptions {
	exposeModels?: boolean
	exposeMessages?: boolean
	exposeP2P?: boolean
}

export function createAPI(app: Canvas, options: APIOptions = {}): express.Express {
	const api = express()

	api.set("query parser", "simple")

	api.get("/", (req, res) => res.json(app.getApplicationData()))

	if (options.exposeModels) {
		api.get("/models/:model/:key", async (req, res) => {
			const { model, key } = req.params
			if (app.db.models[model] === undefined) {
				res.status(StatusCodes.NOT_FOUND).end()
			} else {
				const value = await app.db.get(model, key)
				res.status(StatusCodes.OK)
				res.setHeader("content-type", "application/json")
				res.end(json.encode(value))
			}
		})

		api.get("/models/:model", async (req, res) => {
			// TODO: start/limit/offset
			return res.status(StatusCodes.NOT_IMPLEMENTED).end()
		})
	}

	api.get("/messages/:id", async (req, res) => {
		const { id } = req.params
		const [signature, message] = await app.getMessage(id)
		if (signature === null || message === null) {
			return res.status(StatusCodes.NOT_FOUND).end()
		}

		res.status(StatusCodes.OK)
		res.setHeader("content-type", "application/json")
		res.end(json.encode({ id, signature, message }))
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

		for (const { id, signature, message } of await app.messageLog.export({ gt, gte, lt, lte, reverse, limit })) {
			results.push([id, signature, message])
		}

		res.status(StatusCodes.OK)
		res.setHeader("content-type", "application/json")
		res.end(json.encode(results))
	})

	api.post("/messages", ipld(), async (req, res) => {
		try {
			const { signature, message }: { signature: Signature; message: Message<Action | Session> } = req.body
			const { id } = await app.insert(signature, message)
			res.status(StatusCodes.CREATED)
			res.setHeader("Location", `messages/${id}`)
			res.end()
		} catch (e) {
			console.error(e)
			return res.status(StatusCodes.BAD_REQUEST).end(`${e}`)
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
		res.json({ clock, parents })
	})

	if (options.exposeP2P) {
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

			res.json(results)
		})

		api.get("/mesh/:topic", (req, res) => {
			const gossipsub = app.libp2p.services.pubsub as GossipSub
			res.json(gossipsub.getMeshPeers(req.params.topic))
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

	app.messageLog.addEventListener("sync", ({ detail: { peerId, duration } }) => {
		canvasMetrics.canvas_sync_time.observe({ topic: app.messageLog.topic, peer: peerId }, duration)
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
