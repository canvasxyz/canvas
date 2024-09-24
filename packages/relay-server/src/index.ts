import http from "node:http"

import { createAPI } from "./api.js"
import { getLibp2p } from "./libp2p.js"

const { PORT = "8000", FLY_APP_NAME } = process.env
const hostname = FLY_APP_NAME !== undefined ? `${FLY_APP_NAME}.internal` : "localhost"

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

const api = createAPI(libp2p)

http.createServer(api).listen(parseInt(PORT), () => {
	console.log(`HTTP API listening on http://${hostname}:${PORT}`)
})

await libp2p.start()
