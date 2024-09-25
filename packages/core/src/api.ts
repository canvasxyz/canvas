import express from "express"
import { StatusCodes } from "http-status-codes"

import { Counter, Gauge, Summary, Registry, register } from "prom-client"

import * as json from "@ipld/dag-json"

import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { createAPI as createBaseAPI, getLimit, getOrder, getRange } from "@canvas-js/gossiplog/api"
import { assert } from "@canvas-js/utils"

import { Canvas } from "./Canvas.js"
import { isAction, isSession } from "./utils.js"

export interface APIOptions {}

export function createAPI(app: Canvas): express.Express {
	const api = createBaseAPI(app.messageLog)

	api.get("/", (req, res) => void res.json(app.getApplicationData()))

	api.get("/actions/count", async (req, res) => {
		const range = getRange(req)
		const { did, name } = req.query
		assert(did === undefined || typeof did === "string", "invalid `did` query parameter")
		assert(name === undefined || typeof name === "string", "invalid `name` query parameter")
		const count = await app.db.count("$actions", { message_id: range, did, name })
		return void res.json({ count })
	})

	api.get("/actions", async (req, res) => {
		const [range, order, limit] = [getRange(req), getOrder(req), getLimit(req)]

		const { did, name } = req.query
		assert(did === undefined || typeof did === "string", "invalid `did` query parameter")
		assert(name === undefined || typeof name === "string", "invalid `name` query parameter")

		type MessageRecord = { id: string; signature: Signature; message: Message<Action> }
		const results: MessageRecord[] = []

		if (did !== undefined || name !== undefined) {
			const messageIds: string[] = []

			for await (const { message_id } of app.db.iterate("$actions", { where: { did, name } })) {
				const count = messageIds.push(message_id)
				if (count >= limit) {
					break
				}
			}

			for (const id of messageIds) {
				const signedMessage = await app.db.get("$messages", id)
				assert(signedMessage !== null, "internal error - missing record in $messages")
				const { signature, message } = signedMessage
				results.push({ id, signature, message })
			}
		} else {
			for await (const { id, signature, message } of app.db.iterate<{
				id: string
				signature: Signature
				message: Message<Action | Session>
			}>("$messages", {
				select: { id: true, signature: true, message: true },
				where: { id: range },
				orderBy: { id: order },
				limit,
			})) {
				if (isAction(message)) {
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

	api.get("/sessions/count", async (req, res) => {
		const range = getRange(req)
		const { did, publicKey, minExpiration } = req.query
		assert(did === undefined || typeof did === "string", "invalid `did` query parameter")
		assert(publicKey === undefined || typeof publicKey === "string", "invalid `publicKey` query parameter")
		assert(minExpiration === undefined || typeof minExpiration === "string", "invalid `minExpiration` query parameter")

		if (minExpiration !== undefined) {
			const minExpirationValue = parseInt(minExpiration)
			assert(Number.isSafeInteger(minExpirationValue), "invalid `minExpiration` query parameter")

			let count = 0
			for await (const { expiration } of app.db.iterate("$sessions", {
				where: { message_id: range, did, public_key: publicKey },
			})) {
				if (expiration === null || minExpirationValue <= expiration) {
					count++
				}
			}

			return void res.json({ count })
		} else {
			const count = await app.db.count("$sessions", { message_id: range, did, public_key: publicKey })
			return void res.json({ count })
		}
	})

	api.get("/sessions", async (req, res) => {
		const [range, order, limit] = [getRange(req), getOrder(req), getLimit(req)]
		const { did, publicKey } = req.query

		assert(did === undefined || typeof did === "string", "invalid `did` query parameter")
		assert(publicKey === undefined || typeof publicKey === "string", "invalid `publicKey` query parameter")

		let minExpiration: number | undefined = undefined
		if (typeof req.query.minExpiration === "string") {
			minExpiration = parseInt(req.query.minExpiration)
			assert(Number.isSafeInteger(minExpiration), "invalid `minExpiration` query parameter")
		}

		type MessageRecord = { id: string; signature: Signature; message: Message<Session> }
		const results: MessageRecord[] = []

		if (did !== undefined || publicKey !== undefined) {
			const messageIds: string[] = []

			for await (const { message_id, expiration } of app.db.iterate<{
				message_id: string
				expiration: number | null
			}>("$sessions", {
				select: { message_id: true, expiration: true },
				where: { message_id: range, did, publicKey },
				orderBy: { message_id: order },
			})) {
				if (minExpiration === undefined || expiration === null || minExpiration <= expiration) {
					const count = messageIds.push(message_id)
					if (count >= limit) {
						break
					}
				}
			}

			for (const id of messageIds) {
				const signedMessage = await app.db.get<MessageRecord>("$messages", id)
				assert(signedMessage !== null, "internal error - missing record in $messages")
				const { signature, message } = signedMessage
				results.push({ id, signature, message })
			}
		} else {
			for await (const { id, signature, message } of app.db.iterate<{
				id: string
				signature: Signature
				message: Message<Action | Session>
			}>("$messages", {
				select: { id: true, signature: true, message: true },
				where: { id: range },
				orderBy: { id: order },
			})) {
				if (isSession(message)) {
					const { timestamp, duration } = message.payload.context
					if (minExpiration === undefined || duration === undefined || minExpiration < timestamp + duration) {
						const count = results.push({ id, signature, message })
						if (count >= limit) {
							break
						}
					}
				}
			}
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode(results))
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
