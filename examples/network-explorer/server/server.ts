import cors from "cors"
import express from "express"
import ipld from "express-ipld"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { createDatabase } from "./database.js"
import { consumeOrderedIterators } from "./utils.js"

const HTTP_PORT = parseInt(process.env.PORT || "3000", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"
const topics = ["chat-example.canvas.xyz"]

console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

const { queries } = createDatabase(":memory:")

const expressApp = express()
expressApp.use(cors())

const canvasApps: Record<string, Canvas> = {}

for (const topic of topics) {
	console.log(`initializing canvas for topic ${topic}`)

	const canvasApp = await Canvas.initialize({
		// do we need a separate database url for each topic?
		path: process.env.DATABASE_URL,
		contract: {
			topic,
			models: {},
			actions: {},
		},
		signers: [new SIWESigner()],
		bootstrapList: [],
		listen: [`/ip4/0.0.0.0/tcp/8080/ws`],
	})

	// create empty counts row for this topic in the index table
	queries.addCountsRow.run(topic)

	canvasApp.addEventListener("message", async (event) => {
		const message = event.detail

		if (message.message.payload.type == "action") {
			queries.incrementActionCounts.run(message.message.topic)
		} else if (message.message.payload.type == "session") {
			queries.addAddress.run(message.message.topic, message.message.payload.address)
			queries.incrementSessionCounts.run(message.message.topic)
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

	const messageIterators = Object.values(canvasApps).map((app) =>
		app.getMessages(undefined, undefined, { reverse: true })[Symbol.asyncIterator](),
	)
	const result = await consumeOrderedIterators(
		messageIterators,
		(a, b) => a[2].payload.context.timestamp > b[2].payload.context.timestamp,
		numMessagesToReturn,
	)

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/counts", (req, res) => {
	const queryResult = queries.selectCountsAll.all() as any
	const addressCountResult = queries.selectAddressCountsAll.all() as any
	const addressCountsMap: Record<string, number> = {}
	for (const row of addressCountResult) {
		addressCountsMap[row.topic] = row.count
	}

	for (const row of queryResult) {
		row.address_count = addressCountsMap[row.topic] || 0
	}

	res.json(queryResult)
})

expressApp.get("/index_api/counts/total", (req, res) => {
	const queryResult = queries.selectCountsTotal.get() || ({} as any)
	const addressCountResult = queries.selectAddressCountTotal.get() as any
	const result = {
		action_count: queryResult.action_count || 0,
		session_count: queryResult.session_count || 0,
		address_count: addressCountResult.count || 0,
	}
	res.json(result)
})

expressApp.get("/index_api/counts/:topic", (req, res) => {
	const queryResult = queries.selectCounts.get(req.params.topic) || ({} as any)
	const addressCountResult = queries.selectAddressCount.get(req.params.topic) as any
	const result = {
		topic: req.params.topic,
		action_count: queryResult.action_count || 0,
		session_count: queryResult.session_count || 0,
		address_count: addressCountResult.count || 0,
	}
	res.json(result)
})

expressApp.get("/index_api/latest_session/:topic", async (req, res) => {
	// message.signature.publicKey
	const canvasApp = canvasApps[req.params.topic]
	if (!canvasApp) {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}
	if (
		!req.query.address ||
		typeof req.query.address !== "string" ||
		!req.query.public_key ||
		typeof req.query.public_key !== "string"
	) {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	// timestamp is optional but if given, it must be a string
	if (req.query.timestamp && typeof req.query.timestamp !== "string") {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const sessionId = await canvasApp.getSession({
		address: req.query.address,
		publicKey: req.query.public_key,
		timestamp: req.query.timestamp ? parseInt(req.query.timestamp) : undefined,
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
