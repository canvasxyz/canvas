import { anySignal } from "any-signal"

import { NetworkClient } from "@canvas-js/gossiplog/client"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"
import { getLibp2p } from "./libp2p.js"
import { getPrivateKey } from "./privateKey.js"

const target: PlatformTarget = {
	async connect(gossipLog, url, options = {}) {
		assert(url.startsWith("ws://") || url.startsWith("wss://"), "url must start with ws:// or wss://")

		const client = new NetworkClient(gossipLog, url)
		const signal = anySignal([gossipLog.controller.signal, options.signal])
		signal.addEventListener("abort", () => client.close())
		await client.duplex.connected()

		return client
	},

	async listen(gossipLog, port, options) {
		throw new Error("Cannot start API server in the browser")
	},

	async startLibp2p(gossipLog, config) {
		let privateKey = config.privateKey
		if (privateKey === undefined) {
			privateKey = await getPrivateKey()
		}

		return await getLibp2p(gossipLog, { ...config, privateKey })
	},
}

export default target
