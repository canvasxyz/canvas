import cors from "cors"
import express from "express"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

import { contract, contractTopic } from "./contract.js"

const dev = process.env.NODE_ENV !== "production"

const PORT = parseInt(process.env.PORT || "3333", 10)
const HTTP_ADDR = "0.0.0.0"

const DATABASE_URL = process.env.DATABASE_URL
const LIBP2P_PORT = parseInt(process.env.LIBP2P_PORT || "3334", 10)
const LIBP2P_ANNOUNCE_HOST = process.env.LIBP2P_ANNOUNCE_HOST || "my-example.p2p.app"
const LIBP2P_ANNOUNCE_PORT = parseInt(process.env.LIBP2P_ANNOUNCE_PORT || "80", 10)
const BOOTSTRAP_LIST = process.env.BOOTSTRAP_LIST || []

console.log(`DATABASE_URL: ${DATABASE_URL}`)
console.log(`dev: ${dev}`)
console.log(`PORT: ${PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)

console.log(`LIBP2P_PORT: ${LIBP2P_PORT}`)
console.log(`LIBP2P_ANNOUNCE_HOST: ${LIBP2P_ANNOUNCE_HOST}`)
console.log(`LIBP2P_ANNOUNCE_PORT: ${LIBP2P_ANNOUNCE_PORT}`)
console.log(`BOOTSTRAP_LIST: ${BOOTSTRAP_LIST}`)

const expressApp = express()
expressApp.use(
	cors({
		origin: "*",
	}),
)

console.log(`initializing canvas for topic ${contractTopic}`)

const canvasApp = await Canvas.initialize({
	path: DATABASE_URL,
	contract,
	signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner({}), new SolanaSigner()],
	topic: contractTopic,
})

const libp2p = await canvasApp.startLibp2p({
	listen: [`/ip4/0.0.0.0/tcp/${LIBP2P_PORT}/ws`],
	announce: [`/dns4/${LIBP2P_ANNOUNCE_HOST}/tcp/${LIBP2P_ANNOUNCE_PORT}/wss`],
	bootstrapList: typeof BOOTSTRAP_LIST === "string" ? [BOOTSTRAP_LIST] : BOOTSTRAP_LIST,
})

console.log(`peer id: ${libp2p.peerId}`)

const canvasApiApp = createAPI(canvasApp)
expressApp.use("/api/", canvasApiApp)

expressApp.use(
	express.static("dist", {
		setHeaders: (res, path) => {
			if (path.endsWith(".js") || path.endsWith(".js/")) {
				res.setHeader("Content-Type", "application/javascript")
			} else if (path.endsWith(".css") || path.endsWith(".css/")) {
				res.setHeader("Content-Type", "text/css")
			}
		},
	}),
)

expressApp.listen(PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${PORT}`)
})
