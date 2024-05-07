import express from "express"
import next from "next"

import { Canvas, createAPI, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const HTTP_PORT = parseInt(process.env.PORT || "3000", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"

console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

console.log("initializing next.js")
const nextApp = next({ dev })
const handle = nextApp.getRequestHandler()
await nextApp.prepare()

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
	bootstrapList: [
		"/dns4/canvas-chat-discovery-staging-p0.fly.dev/tcp/443/wss/p2p/12D3KooWFtS485QGEZwquMQbq7MZTMxiuHs6xUKEi664i4yWUhWa",
		"/dns4/canvas-chat-discovery-staging-p1.fly.dev/tcp/443/wss/p2p/12D3KooWPix1mT8QavTjfiha3hWy85dQDgPb9VWaxRhY8Yq3cC7L",
		"/dns4/canvas-chat-discovery-staging-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRbxAWmpvc9U7q1ftBTd3bKa1iQ2rn6RkwRb1d9K7hVg5",
		"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
		"/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWKGP8AqaPALAqjUf9Bs7KtKtkwDavZBjWhaPqKnisQL7M",
		"/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWAC1vj6ZGhbW8jgsDCZDK3y2sSJG2QGVZEqhEK7Rza8ic",
		...defaultBootstrapList,
	],
})

console.log("initializing libp2p")
await canvasApp.libp2p.start()

console.log("initializing express")
const canvasApiApp = createAPI(canvasApp, { exposeMessages: true, exposeModels: true, exposeP2P: true })

const expressApp = express()

expressApp.use("/api", canvasApiApp)

expressApp.all("*", (req, res) => {
	return handle(req, res)
})

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
