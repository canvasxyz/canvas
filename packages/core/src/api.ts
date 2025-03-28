import express from "express"
import { StatusCodes } from "http-status-codes"

import { Counter, Gauge, Summary, Registry, register } from "prom-client"

import * as json from "@ipld/dag-json"

import { Action, Message, Session, Signature } from "@canvas-js/interfaces"
import { createAPI as createBaseAPI, getLimit, getOrder, getRange } from "@canvas-js/gossiplog/api"
import { assert } from "@canvas-js/utils"

import { Canvas } from "./Canvas.js"
import { SignedMessage } from "@canvas-js/gossiplog"
import { WhereCondition } from "@canvas-js/modeldb"

export interface APIOptions {}

export function createAPI(app: Canvas): express.Express {
	const api = createBaseAPI(app.messageLog)

	api.get("/", async (req, res) => {
		res.json(await app.getApplicationData())
	})

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

		const where = did !== undefined || name !== undefined ? { did, name } : { message_id: range }

		const messageIds: string[] = (
			await app.db.query("$actions", { select: { message_id: true }, where, limit, orderBy: { message_id: order } })
		).map(({ message_id }) => message_id)
		const signedMessages = await app.db.getMany<SignedMessage<Action>>("$messages", messageIds)

		for (const signedMessage of signedMessages) {
			assert(signedMessage !== null, "internal error - missing record in $messages")
			const { signature, message } = signedMessage
			results.push({ id: signedMessage.id, signature, message })
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

		const where: WhereCondition = { message_id: range }
		if (did !== undefined) {
			where.did = did
		}

		if (publicKey !== undefined) {
			where.public_key = publicKey
		}

		let messageIds: string[] = []
		if (minExpiration !== undefined) {
			// we have to iterate over $sessions
			// because we can't construct a query that filters the $sessions table
			// based on the expiration field
			for await (const { message_id, expiration } of app.db.iterate<{
				message_id: string
				expiration: number | null
			}>("$sessions", {
				select: { message_id: true, expiration: true },
				where: { message_id: range, did, public_key: publicKey },
				orderBy: { message_id: order },
			})) {
				if (expiration === null || minExpiration <= expiration) {
					const count = messageIds.push(message_id)
					if (count >= limit) {
						break
					}
				}
			}
		} else {
			messageIds = (
				await app.db.query<{
					message_id: string
				}>("$sessions", {
					select: { message_id: true },
					where: { message_id: range, did, public_key: publicKey },
					orderBy: { message_id: order },
					limit,
				})
			).map(({ message_id }) => message_id)
		}

		for (const id of messageIds) {
			const signedMessage = await app.db.get<MessageRecord>("$messages", id)
			assert(signedMessage !== null, "internal error - missing record in $messages")
			const { signature, message } = signedMessage
			results.push({ id, signature, message })
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode(results))
	})

	api.get("/dids", async (req, res) => {
		const dids = await app.db.query("$dids")
		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode(dids))
	})

	api.get("/dids/count", async (req, res) => {
		const count = await app.db.count("$dids")
		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode({ count: count }))
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
		try {
			const { model } = req.params
			const { where: where_, orderBy: orderBy_, limit: limit_ } = req.query

			const where = typeof where_ === "string" ? JSON.parse(where_ as string) : undefined
			const orderBy = typeof orderBy_ === "string" ? JSON.parse(orderBy_ as string) : undefined
			const limit = typeof limit_ === "string" ? parseInt(limit_ as string) : undefined

			const results = await app.db.query(model, { where, orderBy, limit })

			const countWhere = { ...where }
			// if orderBy is given, then exclude the column that is being sorted in the total count
			// because we want to return the number of entries across all pages
			if (orderBy) {
				const orderByKey = Object.keys(orderBy)[0]
				delete countWhere[orderByKey]
			}

			const totalCount = await app.db.count(model, countWhere)

			res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
			return void res.end(
				json.encode({
					totalCount,
					results,
				}),
			)
		} catch (e: any) {
			res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
			return void res.end(json.encode({ error: e.toString() }))
		}
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
