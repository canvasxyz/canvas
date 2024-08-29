// import http from "node:http"
// import WebSocket from "ws"
// import express from "express"

// import * as Sync from "#protocols/sync"
// import { Server } from "../sync/server.js"

// const WebSocketCodes = {
// 	UNSUPPORTED_DATA: 1003,
// }

// export function createAPI(): http.Server {
// 	const api = express()

// 	api.set("query parser", "simple")

// 	const server = http.createServer(api)

// 	const wss = new WebSocket.Server({ server })

// 	wss.on("connection", (ws) => {
// 		let server: Server | null = null

// 		ws.on("message", (data: Uint8Array, isBinary: boolean) => {
// 			if (!isBinary) {
// 				return ws.close(WebSocketCodes.UNSUPPORTED_DATA)
// 			}

// 			const req = Sync.Request.decode(data)
// 			if (req.getRoot !== undefined) {
// 			}

// 			// Example: Echo the message back to the client
// 			ws.send(`Server received: ${message}`)
// 		})

// 		// Handle WebSocket connection close
// 		ws.on("close", () => {
// 			console.log("Client disconnected")
// 		})
// 	})

// 	return server
// }
