import { createLibp2p } from "libp2p"

import { options } from "./libp2p.js"
import { getAPI } from "./api.js"

const libp2p = await createLibp2p(options)

libp2p.addEventListener("connection:open", ({ detail: connection }) => {
	const addr = connection.remoteAddr.decapsulateCode(421).toString()
	console.log(`[bootstrap-peer] opened connection ${connection.id} to ${connection.remotePeer} on ${addr}`)
})

libp2p.addEventListener("connection:close", ({ detail: connection }) => {
	console.log(`[bootstrap-peer] closed connection ${connection.id} to ${connection.remotePeer}`)
})

await libp2p.start()

console.log("[bootstrap-peer] started libp2p with PeerId", libp2p.peerId.toString())
console.log(
	"[bootstrap-peer] listening on",
	libp2p.getMultiaddrs().map((addr) => addr.toString())
)

const controller = new AbortController()

const server = getAPI(libp2p)
const port = parseInt(process.env.PORT ?? "8000")
server.listen(port, "::", () => {
	const host = `http://localhost:${port}`
	console.log(`[bootstrap-peer] API server listening on ${host}`)
	console.log(`GET  ${host}/connections`)
	console.log(`GET  ${host}/peers/:topic`)
	console.log(`POST ${host}/ping/:peerId`)
})

process.on("SIGINT", () => {
	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
	controller.abort()
	server.close()
	libp2p.stop()
})
