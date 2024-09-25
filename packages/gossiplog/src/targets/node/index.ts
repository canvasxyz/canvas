import http from "node:http"

import express from "express"
import cors from "cors"
import { WebSocketServer } from "ws"
import { anySignal } from "any-signal"

import type { AbstractGossipLog } from "@canvas-js/gossiplog"
import { NetworkClient } from "@canvas-js/gossiplog/client"
import { NetworkServer } from "@canvas-js/gossiplog/server"
import { getLibp2p, ServiceMap, NetworkConfig, GossipSub } from "@canvas-js/gossiplog/libp2p"
import { createAPI } from "@canvas-js/gossiplog/api"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"
import { getPeerId } from "./peerId.js"

const target: PlatformTarget = {
	async connect(gossipLog, url, options = {}) {
		assert(url.startsWith("ws://") || url.startsWith("wss://"), "url must start with ws:// or wss://")

		const client = new NetworkClient(gossipLog, url)
		const signal = anySignal([gossipLog.controller.signal, options.signal])
		signal.addEventListener("abort", () => client.close())
		await client.duplex.connected()
	},

	async listen(gossipLog, port, options = {}) {
		const api = express()
		api.use(cors())
		api.use("/api", createAPI(gossipLog))

		// TODO: add metrics API

		const server = http.createServer(api)
		const network = new NetworkServer(gossipLog)
		const wss = new WebSocketServer({ server, perMessageDeflate: false })
		wss.on("connection", network.handleConnection)

		const signal = anySignal([gossipLog.controller.signal, options.signal])
		signal.addEventListener("abort", () => {
			network.close()
			wss.close(() => server.close())
		})

		await new Promise<void>((resolve) => server.listen(port, resolve))
	},

	async startLibp2p(gossipLog, config) {
		let peerId = config.peerId
		if (peerId === undefined) {
			peerId = await getPeerId()
		}

		return await getLibp2p(gossipLog, { ...config, peerId })
	},
}

export default target
