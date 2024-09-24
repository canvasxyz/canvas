import express from "express"
import { StatusCodes } from "http-status-codes"

import { Counter, Gauge, Summary, Registry, register } from "prom-client"

import * as json from "@ipld/dag-json"

import { createAPI as createGossipLogAPI } from "@canvas-js/gossiplog/api"

import { Canvas } from "./Canvas.js"
import { assert } from "@canvas-js/utils"
import { MAX_MESSAGE_ID } from "@canvas-js/gossiplog"

export interface APIOptions {}

export function createAPI(app: Canvas): express.Express {
	const api = createGossipLogAPI(app.messageLog)

	api.get("/", (req, res) => void res.json(app.getApplicationData()))

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

	api.get("/sessions_list", async (req, res) => {
		let limit: number
		if (!req.query.limit) {
			limit = 10
		} else if (typeof req.query.limit === "string") {
			limit = parseInt(req.query.limit)
		} else {
			res.status(StatusCodes.BAD_REQUEST)
			res.end()
			return
		}

		let before: string
		if (!req.query.before) {
			before = MAX_MESSAGE_ID
		} else if (typeof req.query.before === "string") {
			before = req.query.before
		} else {
			res.status(StatusCodes.BAD_REQUEST)
			res.end()
			return
		}

		const sessionRecords = await app.db.query("$sessions", {
			where: { message_id: { lt: before } },
			limit,
		})

		res.status(StatusCodes.OK)
		res.setHeader("content-type", "application/json")
		res.end(json.encode(sessionRecords))
	})

	api.get("/actions_list", async (req, res) => {
		let limit: number
		if (!req.query.limit) {
			limit = 10
		} else if (typeof req.query.limit === "string") {
			limit = parseInt(req.query.limit)
		} else {
			res.status(StatusCodes.BAD_REQUEST)
			res.end()
			return
		}

		let before: string
		if (!req.query.before) {
			before = MAX_MESSAGE_ID
		} else if (typeof req.query.before === "string") {
			before = req.query.before
		} else {
			res.status(StatusCodes.BAD_REQUEST)
			res.end()
			return
		}

		const actionRecords = await app.db.query("$actions", {
			where: { message_id: { lt: before } },
			limit,
		})

		res.status(StatusCodes.OK)
		res.setHeader("content-type", "application/json")
		res.end(json.encode(actionRecords))
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
