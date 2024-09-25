import http from "node:http"
import process from "node:process"

const { PORT = "8000", FLY_APP_NAME } = process.env

import { getLibp2p } from "./libp2p.js"
import { createAPI } from "./api.js"
const libp2p = await getLibp2p()

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
})

libp2p.addEventListener("connection:open", ({ detail: { remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
})

libp2p.addEventListener("connection:close", ({ detail: { remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
})

const origin = FLY_APP_NAME ? `${FLY_APP_NAME}.internal` : "localhost"

const server = http.createServer(createAPI(libp2p))
server.listen(parseInt(PORT), () => {
	console.log(`API listening on http://${origin}:${PORT}`)
})

let stopping = false

process.addListener("SIGINT", () => {
	if (stopping) {
		process.exit(1)
	}

	stopping = true
	process.stdout.write("\nReceived SIGINT\n")
	libp2p.stop()
	server.close()
})

await libp2p.start()
