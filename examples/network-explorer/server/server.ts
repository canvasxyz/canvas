import cors from "cors"
import express from "express"
import ipld from "express-ipld"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { PrismaClient } from "@prisma/client"
import { getDistinctAddressCount } from "@prisma/client/sql"

// this is copied from @canvas-js/gossiplog - we don't need anything else from that module
const MAX_MESSAGE_ID = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"

const LIBP2P_PORT = parseInt(process.env.LIBP2P_PORT || "3334", 10)
const HTTP_PORT = parseInt(process.env.PORT || "3333", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"
const topics = ["chat-example.canvas.xyz"]

console.log(`LIBP2P_PORT: ${LIBP2P_PORT}`)
console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

const expressApp = express()
expressApp.use(
	cors({
		origin: "*",
	}),
)

const prisma = new PrismaClient()

const canvasApps: Record<string, Canvas> = {}

for (const topic of topics) {
	console.log(`initializing canvas for topic ${topic}`)

	const canvasApp = await Canvas.initialize({
		// do we need a separate database url for each topic?
		path: process.env.DATABASE_URL,
		contract: {
			models: {},
			actions: {
				createMessage() {},
			},
		},
		signers: [new SIWESigner()],
		bootstrapList: [],
		listen: [`/ip4/0.0.0.0/tcp/${LIBP2P_PORT}/ws`],
		topic,
	})

	canvasApp.addEventListener("message", async (event) => {
		const message = event.detail

		if (message.message.payload.type == "action") {
			await prisma.message.upsert({
				create: {
					topic: message.message.topic,
					message_id: message.id,
					type: "action",
				},
				where: { message_id: message.id },
				update: {},
			})
		} else if (message.message.payload.type == "session") {
			await prisma.message.upsert({
				create: {
					topic: message.message.topic,
					message_id: message.id,
					type: "session",
				},
				where: { message_id: message.id },
				update: {},
			})

			await prisma.address.upsert({
				where: { topic_address: { topic: message.message.topic, address: message.message.payload.did } },
				create: { topic: message.message.topic, address: message.message.payload.did },
				update: {},
			})
		}
	})

	await canvasApp.libp2p.start()
	console.log(`peer id: ${canvasApp.libp2p.peerId}`)

	const canvasApiApp = createAPI(canvasApp, { exposeMessages: true, exposeModels: true, exposeP2P: true })
	expressApp.use(`/canvas_api/${topic}`, canvasApiApp)

	canvasApps[topic] = canvasApp
}

expressApp.get("/index_api/messages", ipld(), async (req, res) => {
	const numMessagesToReturn = 20

	let before: string
	if (!req.query.before) {
		before = MAX_MESSAGE_ID
	} else if (typeof req.query.before == "string") {
		before = req.query.before
	} else {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const messageIndexEntries = await prisma.message.findMany({
		where: { message_id: { lt: before } },
		orderBy: { message_id: "desc" },
		take: numMessagesToReturn,
	})

	const result = []
	for (const messageIndexEntry of messageIndexEntries) {
		const app = canvasApps[messageIndexEntry.topic]
		const [signature, message] = await app.getMessage(messageIndexEntry.message_id)
		result.push([messageIndexEntry.message_id, signature, message])
	}

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/messages/:topic", ipld(), async (req, res) => {
	const numMessagesToReturn = 20

	if (req.query.type !== "session" && req.query.type !== "action") {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}
	const type = req.query.type

	let before: string
	if (!req.query.before) {
		before = MAX_MESSAGE_ID
	} else if (typeof req.query.before == "string") {
		before = req.query.before
	} else {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const messageIds = await prisma.message.findMany({
		select: { message_id: true },
		where: { topic: req.params.topic, message_id: { lt: before }, type },
		orderBy: { message_id: "desc" },
		take: numMessagesToReturn,
	})

	const canvasApp = canvasApps[req.params.topic]
	const result = []
	for (const messageId of messageIds) {
		const [signature, message] = await canvasApp.getMessage(messageId.message_id)
		result.push([messageId.message_id, signature, message])
	}

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/counts", async (req, res) => {
	const actionCountResult = await prisma.message.groupBy({
		by: ["topic"],
		where: { type: "action" },
		_count: true,
	})
	const actionCountsMap: Record<string, number> = {}
	for (const row of actionCountResult) {
		row.topic
		actionCountsMap[row.topic] = row._count
	}

	const sessionCountResult = await prisma.message.groupBy({
		by: ["topic"],
		where: { type: "session" },
		_count: true,
	})
	const sessionCountsMap: Record<string, number> = {}
	for (const row of sessionCountResult) {
		sessionCountsMap[row.topic] = row._count
	}

	const addressCountResult = await prisma.address.groupBy({
		by: ["topic"],
		_count: true,
	})
	const addressCountsMap: Record<string, number> = {}
	for (const row of addressCountResult) {
		addressCountsMap[row.topic] = row._count
	}

	const result: { topic: string; action_count: number; session_count: number; address_count: number }[] = []
	const allTopics = new Set([
		...Object.keys(actionCountsMap),
		...Object.keys(sessionCountsMap),
		...Object.keys(addressCountsMap),
	])
	for (const topic of allTopics) {
		result.push({
			topic,
			action_count: actionCountsMap[topic] || 0,
			session_count: sessionCountsMap[topic] || 0,
			address_count: addressCountsMap[topic] || 0,
		})
	}

	res.json(result)
})

expressApp.get("/index_api/counts/total", async (req, res) => {
	const actionCount = await prisma.message.aggregate({ _count: { message_id: true }, where: { type: "action" } })
	const sessionCount = await prisma.message.aggregate({ _count: { message_id: true }, where: { type: "session" } })

	const addressCountDistinctResult = await prisma.$queryRawTyped(getDistinctAddressCount())

	const result = {
		action_count: actionCount._count.message_id || 0,
		session_count: sessionCount._count.message_id || 0,
		address_count: Number(addressCountDistinctResult[0].count) || 0,
	}
	res.json(result)
})

expressApp.get("/index_api/counts/:topic", async (req, res) => {
	const actionCountResult = await prisma.message.count({ where: { topic: req.params.topic, type: "action" } })
	const sessionCountResult = await prisma.message.count({ where: { topic: req.params.topic, type: "session" } })

	const addressCountResult = await prisma.address.aggregate({
		_count: true,
		where: { topic: req.params.topic },
	})
	const result = {
		topic: req.params.topic,
		action_count: actionCountResult,
		session_count: sessionCountResult,
		address_count: addressCountResult._count || 0,
	}
	res.json(result)
})

expressApp.get("/index_api/latest_session/:topic", async (req, res) => {
	const canvasApp = canvasApps[req.params.topic]
	if (!canvasApp) {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}
	if (
		!req.query.did ||
		typeof req.query.did !== "string" ||
		!req.query.public_key ||
		typeof req.query.public_key !== "string"
	) {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const sessionId = await canvasApp.getSession({
		did: req.query.did,
		publicKey: req.query.public_key,
	})

	if (!sessionId) {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}

	const [_signature, message] = await canvasApp.getMessage(sessionId)
	if (!message || message.payload.type !== "session") {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}

	// return using ipld json stringify
	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(message.payload))
})

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
