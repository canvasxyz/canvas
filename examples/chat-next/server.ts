import express from "express"
import next from "next"

import { Canvas } from "@canvas-js/core"
import { createAPI } from "@canvas-js/core/api"
import { SIWESigner } from "@canvas-js/signer-ethereum"

const dev = process.env.NODE_ENV !== "production"
const nextApp = next({ dev })
const handle = nextApp.getRequestHandler()

const HTTP_PORT = process.env.PORT ? Number(process.env.PORT) : 3000
const HTTP_ADDR = "0.0.0.0"

process.on("uncaughtException", (error) => {
	console.error("Unhandled Exception:", error)
})

nextApp.prepare().then(async () => {
	const canvasApp = await Canvas.initialize({
		path: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/chat_postgres",
		topic: "chat-example.canvas.xyz",
		contract: {
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
		// bootstrapList: [
		// 	"/dns4/canvas-chat-discovery-staging-p0.fly.dev/tcp/443/wss/p2p/12D3KooWFtS485QGEZwquMQbq7MZTMxiuHs6xUKEi664i4yWUhWa",
		// 	"/dns4/canvas-chat-discovery-staging-p1.fly.dev/tcp/443/wss/p2p/12D3KooWPix1mT8QavTjfiha3hWy85dQDgPb9VWaxRhY8Yq3cC7L",
		// 	"/dns4/canvas-chat-discovery-staging-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRbxAWmpvc9U7q1ftBTd3bKa1iQ2rn6RkwRb1d9K7hVg5",
		// 	"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
		// 	"/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWKGP8AqaPALAqjUf9Bs7KtKtkwDavZBjWhaPqKnisQL7M",
		// 	"/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWAC1vj6ZGhbW8jgsDCZDK3y2sSJG2QGVZEqhEK7Rza8ic",
		// ],
	})

	const expressApp = express()
	expressApp.use("/api", createAPI(canvasApp))

	expressApp.use(express.json())
	expressApp.set("json spaces", 2)

	expressApp.get("/read", async (req, res) => {
		try {
			const results = await canvasApp.db.query("message", {})
			// const connections = canvasApp.libp2p.getConnections()

			return res.json({
				messages: results,
				// status: canvasApp.status,
				// connectionsLength: connections.length,
				// connections,
			})
		} catch (err) {
			return res.status(400).json({ error: "[Canvas] query failed" })
		}
	})

	expressApp.all("*", (req, res) => {
		return handle(req, res)
	})

	expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
		console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
	})
})
