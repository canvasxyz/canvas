import express from "express"
import { StatusCodes } from "http-status-codes"

import { Counter, Gauge, Summary, Registry, register } from "prom-client"

import * as json from "@ipld/dag-json"
import ipld from "express-ipld"

import { Signature, Message, Session, Action } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { Canvas } from "./Canvas.js"

export interface APIOptions {}

export function createAPI(app: Canvas): express.Express {
	const api = express()

	api.set("query parser", "simple")

	api.get("/", (req, res) => void res.json(app.getApplicationData()))

	api.get("/clock", async (req, res) => {
		const [clock, parents] = await app.messageLog.getClock()
		return void res.json({ clock, parents })
	})

	api.get("/messages/count", async (req, res) => {
		const count = await app.db.count("$messages")
		return void res.json({ count })
	})

	api.get("/messages/:id", async (req, res) => {
		const { id } = req.params

		const signedMessage = await app.messageLog.get(id)
		if (signedMessage === null) {
			return void res.status(StatusCodes.NOT_FOUND).end()
		}

		const { signature, message } = signedMessage
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
		assert(order === undefined || order === "asc" || order === "desc", "invalid `order` query parameter")

		assert(type === undefined || type === "action" || type === "session", "invalid `type` query parameter")

		type MessageRecord = { id: string; signature: Signature; message: Message<Action | Session> }
		const results: MessageRecord[] = []

		if (limit > 0) {
			for await (const { id, signature, message } of app.db.iterate<MessageRecord>("$messages", {
				select: { id: true, signature: true, message: true },
				where: { id: { gt, gte, lt, lte } },
				orderBy: { id: order ?? "asc" },
			})) {
				if (type === undefined || message.payload.type === type) {
					const count = results.push({ id, signature, message })
					if (count >= limit) {
						break
					}
				}
			}
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode(results))
	})

	api.post("/messages", ipld(), async (req, res) => {
		try {
			const { signature, message }: { signature: Signature; message: Message<Action | Session> } = req.body
			const signedMessage = app.messageLog.encode(signature, message)
			await app.messageLog.insert(signedMessage)
			res.status(StatusCodes.CREATED)
			res.setHeader("Location", `messages/${signedMessage.id}`)
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

	api.get("/sessions/count", async (req, res) => {
		const { did, publicKey } = req.query
		assert(did === undefined || typeof did === "string")
		assert(publicKey === undefined || typeof publicKey === "string")
		const count = await app.db.count("$sessions", { did, public_key: publicKey })

		return void res.json({ count })
	})

	api.get("/actions/count", async (req, res) => {
		const { did, name } = req.query
		assert(did === undefined || typeof did === "string")
		assert(name === undefined || typeof name === "string")
		const count = await app.db.count("$actions", { did, name })

		return void res.json({ count })
	})

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

		canvas_sync_duration: new Summary({
			registers: [canvasRegister],
			name: "canvas_sync_duration",
			help: "merkle sync durations",
			labelNames: ["topic", "peer"],
			maxAgeSeconds: 60 * 60,
			ageBuckets: 24,
		}),
	}

	const topic = app.messageLog.topic

	app.messageLog.addEventListener("message", ({ detail: { message } }) => {
		canvasMetrics.canvas_messages.inc({ topic, type: message.payload.type })
	})

	app.messageLog.addEventListener("sync", ({ detail: { peer, duration } }) => {
		canvasMetrics.canvas_sync_duration.observe({ topic, peer }, duration)
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
