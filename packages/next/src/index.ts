import http from "node:http"
import path from "node:path"
import fs from "node:fs"

import { ethers } from "ethers"
import stoppable from "stoppable"
import chalk from "chalk"

import next from "next"
import express from "express"
import { Libp2p, createLibp2p } from "libp2p"
import { createFromProtobuf, createEd25519PeerId, exportToProtobuf } from "@libp2p/peer-id-factory"

import type { ChainImplementation } from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { Core, getAPI, setupWebsockets } from "@canvas-js/core"
import * as constants from "@canvas-js/core/constants"

import type { NextServer, NextServerOptions } from "next/dist/server/next.js"

// declare module "next" {
// 	import type { NextServer } from "next/dist/server/next.js"
// 	export default function createServer(): NextServer
// }

const { CANVAS_PATH, CANVAS_SPEC, ANNOUNCE, LISTEN, PEER_ID, ETH_CHAIN_ID, ETH_CHAIN_RPC, NODE_ENV, VERBOSE, PORT } =
	process.env

const directory = CANVAS_PATH ?? null
const specPath = CANVAS_SPEC ?? path.resolve(directory ?? ".", constants.SPEC_FILENAME)
const spec = fs.readFileSync(specPath, "utf-8")

const verbose = NODE_ENV !== "production" || VERBOSE === "true"

const chains: ChainImplementation[] = []
let unchecked = true
if (typeof ETH_CHAIN_ID === "string" && typeof ETH_CHAIN_RPC === "string") {
	unchecked = false
	chains.push(new EthereumChainImplementation(ETH_CHAIN_ID, new ethers.providers.JsonRpcProvider(ETH_CHAIN_RPC)))
} else {
	chains.push(new EthereumChainImplementation())
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

if (NODE_ENV === "production") {
	const peeringPort = Number(LISTEN) || 4044
	const peerId = await getPeerID()

	console.log("[canvas-next] Using PeerId", peerId.toString())

	let announce: undefined | string[] = undefined
	if (typeof ANNOUNCE === "string") {
		announce = [ANNOUNCE]
	}

	global.core = await Core.initialize({ directory, spec, chains, port: peeringPort, announce, unchecked, verbose })
} else {
	global.core = await Core.initialize({ directory, spec, chains, unchecked, offline: true, verbose })
}

const port = Number(PORT) || 3000
const hostname = "localhost"

const createServer = next as unknown as (options: NextServerOptions) => NextServer
const nextApp = createServer({ dev: NODE_ENV !== "production", hostname, port })
await nextApp.prepare()

const nextAppHandler = nextApp.getRequestHandler()
const app = express()
app.use("/app", getAPI(core))
app.use("/", (req, res, next) => nextAppHandler(req, res))

const httpServer = http.createServer(app)
setupWebsockets(httpServer, core)

const server = stoppable(httpServer, 0)

server.listen(port, () => console.log(`> Ready on http://${hostname}:${port}`))

let stopping = false
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
