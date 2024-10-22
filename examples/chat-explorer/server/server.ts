import cors from "cors"
import express from "express"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

const topic = process.env.TOPIC || "chat-example.canvas.xyz"

const BOOTSTRAP_LIST = process.env.BOOTSTRAP_LIST || [
	"/dns4/canvas-chat-example-libp2p.p2p.app/tcp/443/wss/p2p/12D3KooWNCqJHo8BNdjTUmq51xudtrDPFTCKCD2Pf87FXHGXcSXD",
]

const HTTP_PORT = parseInt(process.env.PORT || "3333", 10)
const LIBP2P_PORT = parseInt(process.env.LIBP2P_PORT || "3334", 10)
const LIBP2P_ANNOUNCE_HOST = process.env.LIBP2P_ANNOUNCE_HOST || "my-example.p2p.app"
const LIBP2P_ANNOUNCE_PORT = parseInt(process.env.LIBP2P_ANNOUNCE_PORT || "80", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"

console.log(`BOOTSTRAP_LIST: ${BOOTSTRAP_LIST}`)
console.log(`LIBP2P_PORT: ${LIBP2P_PORT}`)
console.log(`LIBP2P_ANNOUNCE_PORT: ${LIBP2P_ANNOUNCE_PORT}`)
console.log(`LIBP2P_ANNOUNCE_HOST: ${LIBP2P_ANNOUNCE_HOST}`)
console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

const expressApp = express()
expressApp.use(
	cors({
		origin: "*",
	}),
)

console.log(`initializing canvas for topic ${topic}`)

const canvasApp = await Canvas.initialize({
	contract: {
		models: {},
		actions: {
			createMessage() {},
		},
	},
	signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner({}), new SolanaSigner()],
	topic,
})

const libp2p = await canvasApp.startLibp2p({
	listen: [`/ip4/0.0.0.0/tcp/${LIBP2P_PORT}/ws`],
	announce: [`/dns4/${LIBP2P_ANNOUNCE_HOST}/tcp/${LIBP2P_ANNOUNCE_PORT}/wss`],
	bootstrapList: typeof BOOTSTRAP_LIST === "string" ? [BOOTSTRAP_LIST] : BOOTSTRAP_LIST,
})

console.log(`peer id: ${libp2p.peerId}`)

const canvasApiApp = createAPI(canvasApp)
expressApp.use("/api/", canvasApiApp)

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
