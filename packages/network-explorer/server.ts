import cors from "cors"
import express from "express"

import { createAPI } from "@canvas-js/core/api"
import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { createDatabase } from "./database"

const HTTP_PORT = parseInt(process.env.PORT || "3000", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"

console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

const db = createDatabase(":memory:")
const incrementActionCountsQuery = db.prepare(`
	INSERT INTO counts(topic, action_count, session_count)
	VALUES (?, 1, 0)
	ON CONFLICT (topic)
	DO UPDATE SET action_count=action_count+1;
`)

const incrementSessionCountsQuery = db.prepare(`
	INSERT INTO counts(topic, action_count, session_count)
	VALUES (?, 0, 1)
	ON CONFLICT (topic)
	DO UPDATE SET session_count=session_count+1;
`)

const selectCountsQuery = db.prepare(`SELECT * FROM counts WHERE topic = ?`)

console.log("initializing canvas")
const canvasApp = await Canvas.initialize({
	path: process.env.DATABASE_URL,
	contract: {
		topic: "chat-example.canvas.xyz",
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
		incrementActionCountsQuery.run(message.message.topic)
	} else if (message.message.payload.type == "session") {
		incrementSessionCountsQuery.run(message.message.topic)
	}
})

console.log("initializing libp2p")
await canvasApp.libp2p.start()
console.log(`peer id: ${canvasApp.libp2p.peerId}`)

console.log("initializing express")
const expressApp = express()
expressApp.use(cors())

console.log("initializing canvas api")
const canvasApiApp = createAPI(canvasApp, { exposeMessages: true, exposeModels: true, exposeP2P: true })
expressApp.use("/api", canvasApiApp)

expressApp.get("/api/counts/:topic", (req, res) => {
	const queryResult = selectCountsQuery.get(req.params.topic) || ({} as any)
	const result = {
		topic: req.params.topic,
		action_count: queryResult.action_count || 0,
		session_count: queryResult.session_count || 0,
	}
	res.json(result)
})

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
