import { anySignal } from "any-signal"

import { NetworkClient } from "@canvas-js/gossiplog/client"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async connect(gossipLog, url, options = {}) {
		assert(url.startsWith("ws://") || url.startsWith("wss://"), "url must start with ws:// or wss://")

		const client = new NetworkClient(gossipLog, url)
		const signal = anySignal([gossipLog.controller.signal, options.signal])
		signal.addEventListener("abort", () => client.close())
		await client.duplex.connected()
	},

	async listen(gossipLog, port, options) {
		throw new Error("Cannot start API server in react native")
	},

	async startLibp2p(gossipLog, config) {
		throw new Error("Cannot start libp2p in react native")
	},
}

export default target
