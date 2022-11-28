import http from "node:http"
import path from "node:path"
import fs from "node:fs"

import stoppable from "stoppable"
import chalk from "chalk"
import next from "next"
import express from "express"
import { Libp2p, createLibp2p } from "libp2p"
import { createFromProtobuf, createEd25519PeerId, exportToProtobuf } from "@libp2p/peer-id-factory"
import { ethers } from "ethers"

import { constants, Core, getLibp2pInit, getAPI } from "@canvas-js/core"

const directory = process.env.CANVAS_PATH ?? null
const specPath = process.env.CANVAS_SPEC ?? path.resolve(directory ?? ".", constants.SPEC_FILENAME)
const spec = fs.readFileSync(specPath, "utf-8")

const { ANNOUNCE, LISTEN, PEER_ID, ETH_CHAIN_ID, ETH_CHAIN_RPC, NODE_ENV, VERBOSE } = process.env

const verbose = NODE_ENV !== "production" || VERBOSE === "true"

const providers: Record<string, ethers.providers.JsonRpcProvider> = {}
let unchecked = true
if (typeof ETH_CHAIN_ID === "string" && typeof ETH_CHAIN_RPC === "string") {
	unchecked = false
	const key = `eth:${process.env.ETH_CHAIN_ID}`
	providers[key] = new ethers.providers.JsonRpcProvider(ETH_CHAIN_RPC)
}

async function getPeerID() {
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	}

	const peerIdPath = path.resolve(directory ?? ".", constants.PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		return await createFromProtobuf(Buffer.from(fs.readFileSync(peerIdPath)))
	} else {
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		return peerId
	}
}

if (typeof LISTEN === "string") {
	const peerId = await getPeerID()

	console.log("[canvas-next] Using PeerId", peerId.toString())

	let libp2p: Libp2p
	if (typeof ANNOUNCE === "string") {
		libp2p = await createLibp2p(getLibp2pInit(peerId, Number(LISTEN), [ANNOUNCE]))
	} else {
		libp2p = await createLibp2p(getLibp2pInit(peerId, Number(LISTEN)))
	}

	await libp2p.start()
	console.log("[canvas-next] Started libp2p", directory)

	global.core = await Core.initialize({ directory, spec, providers, unchecked, libp2p, offline: false, verbose })
	global.core.addEventListener("close", () => libp2p.stop())
} else {
	global.core = await Core.initialize({ directory, spec, providers, unchecked, offline: true, verbose })
}

const port = Number(process.env.PORT) || 3000
const hostname = "localhost"
const nextApp = next({ dev: process.env.NODE_ENV !== "production", hostname, port })
await nextApp.prepare()

const nextAppHandler = nextApp.getRequestHandler()
const app = express()
app.use("/app", getAPI(core))
app.use("/", (req, res, next) => nextAppHandler(req, res))

const server = stoppable(http.createServer(app), 0)

server.listen(port, () => console.log(`> Ready on http://${hostname}:${port}`))

let stopping: boolean = false
process.on("SIGINT", () => {
	if (stopping) {
		process.exit(1)
	} else {
		stopping = true
		process.stdout.write(
			`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`
		)

		nextApp.close().then(() => {
			server.stop()
			global.core.close()
		})
	}
})
