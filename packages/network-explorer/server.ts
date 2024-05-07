import cors from "cors"
import express from "express"

import { createAPI } from "@canvas-js/core/api"
import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const HTTP_PORT = parseInt(process.env.PORT || "3000", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"

console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

console.log("initializing canvas")
const canvasApp = await Canvas.initialize({
	path: process.env.DATABASE_URL,
	contract: {
		topic: "chat-example.canvas.xyz",
		models: {
			message: {
				id: "primary",
				address: "string",
				content: "string",
				timestamp: "integer",
				$indexes: ["address", "timestamp"],
			},
		},
		actions: {
			async createMessage(db, { content }, { id, address, timestamp }) {
				await db.set("message", { id, address, content, timestamp })
			},
		},
	},
	signers: [new SIWESigner()],
	indexHistory: false,
	discoveryTopic: "canvas-discovery",
	trackAllPeers: true,
	presenceTimeout: 12 * 60 * 60 * 1000, // keep up to 12 hours of offline peers
	bootstrapList: [],
	listen: [`/ip4/0.0.0.0/tcp/8080/ws`],
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

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
