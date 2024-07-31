import http from "node:http"

import { app } from "./api.js"
import { getLibp2p } from "./libp2p.js"

const { PORT = "3000", FLY_APP_NAME } = process.env
const hostname = FLY_APP_NAME !== undefined ? `${FLY_APP_NAME}.internal` : "localhost"

http.createServer(app).listen(parseInt(PORT), () => {
	console.log(`HTTP API listening on http://${hostname}:${PORT}`)
})

getLibp2p().then((libp2p) => {
	app.get("/topicMap", (req, res) => {
		const { topicMap } = libp2p.services.discovery
		res.json(Object.fromEntries(Array.from(topicMap).map(([key, value]) => [key, Array.from(value)])))
	})

	app.get("/topicIndex", (req, res) => {
		const { topicIndex } = libp2p.services.discovery
		res.json(Object.fromEntries(Array.from(topicIndex).map(([key, value]) => [key, Array.from(value)])))
	})

	libp2p.start()
})
