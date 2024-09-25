import cors from "cors"
import express from "express"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

const BOOTSTRAP_LIST =
	process.env.BOOTSTRAP_LIST ||
	"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q"
const LIBP2P_PORT = parseInt(process.env.LIBP2P_PORT || "8889", 10)
const HTTP_PORT = parseInt(process.env.PORT || "8888", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"
const topic = process.env.TOPIC || "chat-example.canvas.xyz"

console.log(`BOOTSTRAP_LIST: ${BOOTSTRAP_LIST}`)
console.log(`LIBP2P_PORT: ${LIBP2P_PORT}`)
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
	// do we need a separate database url for each topic?
	// path: process.env.DATABASE_URL,
	contract: {
		models: {},
		actions: {
			createMessage() {},
		},
	},
	signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner({}), new SolanaSigner()],
	topic,
	schema: {
		$addresses_index: {
			address: "primary",
		},
	},
})

// await canvasApp.listen({
// 	bootstrapList: [BOOTSTRAP_LIST],
// 	listen: [`/ip4/0.0.0.0/tcp/${LIBP2P_PORT}/ws`],
// })

canvasApp.addEventListener("message", async (event) => {
	const message = event.detail
	if (message.message.payload.type === "session") {
		await canvasApp.messageLog.db.set("$addresses_index", {
			address: message.message.payload.did,
		})
	}
})

// await canvasApp.libp2p.start()
// console.log(`peer id: ${canvasApp.libp2p.peerId}`)

const canvasApiApp = createAPI(canvasApp)
canvasApiApp.get("/addresses/count", async (req, res) => {
	const addressesCount = await canvasApp.messageLog.db.count("$addresses_index")
	res.writeHead(200, { "content-type": "application/json" })
	res.end(JSON.stringify({ count: addressesCount }))
})

expressApp.use("/", canvasApiApp)

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
