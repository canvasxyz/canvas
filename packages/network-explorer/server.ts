import cors from "cors"
import express from "express"
import ipld from "express-ipld"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import { createAPI } from "@canvas-js/core/api"
import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { createDatabase } from "./database"
import { consumeOrderedIterators } from "./utils"

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

const canvasApps: Canvas[] = []

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
		ignoreMissingActions: true,
		signers: [new SIWESigner()],
		indexHistory: false,
		discoveryTopic: "canvas-discovery",
		trackAllPeers: true,
		presenceTimeout: 12 * 60 * 60 * 1000, // keep up to 12 hours of offline peers
		bootstrapList: [],
		listen: [`/ip4/0.0.0.0/tcp/8080/ws`],
	})

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

	canvasApps.push(canvasApp)
}

expressApp.get("/index_api/messages", ipld(), async (req, res) => {
	const numMessagesToReturn = 20

	const messageIterators = canvasApps.map((app) =>
		app.getMessages(undefined, undefined, { reverse: true })[Symbol.asyncIterator](),
	)
	const result = await consumeOrderedIterators(
		messageIterators,
		(a, b) => a[2].payload.timestamp > b[2].payload.timestamp,
		numMessagesToReturn,
	)

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/counts", (req, res) => {
	const queryResult = queries.selectCountsAll.all() as any
	const addressCountResult = queries.selectAddressCountsAll.all() as any
	const addressCountsMap = {}
	for (const row of addressCountResult) {
		addressCountsMap[row.topic] = row.count
	}

	for (const row of queryResult) {
		row.address_count = addressCountsMap[row.topic]
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

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
