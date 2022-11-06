#!/usr/bin/env node

import http from "node:http"
import path from "node:path"
import fs from "node:fs"

import stoppable from "stoppable"
import chalk from "chalk"
import next from "next"
import express from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"
import { createLibp2p } from "libp2p"
import { createFromProtobuf } from "@libp2p/peer-id-factory"
import { ethers } from "ethers"

import { constants, Core, getLibp2pInit } from "@canvas-js/core"
import { handleAction, handleRoute, handleSession } from "./api.js"

const directory = process.env.CANVAS_PATH ?? null
const specPath = process.env.CANVAS_SPEC ?? path.resolve(directory ?? ".", constants.SPEC_FILENAME)
const spec = fs.readFileSync(specPath, "utf-8")

const { LISTEN, VERBOSE, PEER_ID, ETH_CHAIN_ID, ETH_CHAIN_RPC } = process.env

const providers: Record<string, ethers.providers.JsonRpcProvider> = {}
let unchecked = true
if (typeof ETH_CHAIN_ID === "string" && typeof ETH_CHAIN_RPC === "string") {
	unchecked = false
	const key = `eth:${process.env.ETH_CHAIN_ID}`
	providers[key] = new ethers.providers.JsonRpcProvider(ETH_CHAIN_RPC)
}

if (typeof LISTEN === "string" && typeof PEER_ID === "string") {
	const peerId = await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	console.log("[canvas-next] Using PeerId", peerId.toString())
	const libp2p = await createLibp2p(getLibp2pInit(peerId, Number(LISTEN)))
	await libp2p.start()
	console.log("[canvas-next] Started libp2p", directory)
	global.core = await Core.initialize({ directory, spec, providers, unchecked, libp2p, offline: false, verbose: !!VERBOSE })
	global.core.addEventListener("close", () => libp2p.stop())
} else {
	global.core = await Core.initialize({ directory, spec, providers, unchecked, offline: true, verbose: !!VERBOSE })
}

const port = Number(process.env.PORT) || 3000
const hostname = "localhost"
const nextApp = next({ dev: process.env.NODE_ENV !== "production", hostname, port })
await nextApp.prepare()
const nextAppHandler = nextApp.getRequestHandler()

const prefix = `/app/${core.cid.toString()}`

const canvasRouteHandler = express()
canvasRouteHandler.use(bodyParser.json())
canvasRouteHandler.get("/app/:name/*", (req, res) => {
	const { name } = req.params
	if (name !== core.cid.toString()) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	const path = req.path.slice(prefix.length)
	const pathComponents = path === "" || path === "/" ? [] : path.slice(1).split("/")

	handleRoute(core, pathComponents, req, res)
})

canvasRouteHandler.post("/app/:name/sessions", (req, res) => {
	const { name } = req.params
	if (name !== core.cid.toString()) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	handleSession(core, req, res)
})

canvasRouteHandler.post("/app/:name/actions", (req, res) => {
	const { name } = req.params
	if (name !== core.cid.toString()) {
		return res.status(StatusCodes.NOT_FOUND).end()
	}

	handleAction(core, req, res)
})

const server = stoppable(
	http.createServer((req, res) => {
		if (typeof req.url === "string" && req.url.startsWith(prefix)) {
			canvasRouteHandler(req, res)
		} else {
			nextAppHandler(req, res)
		}
	}),
	0
)

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
