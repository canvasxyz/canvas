import type { Libp2p } from "libp2p"

import type { PlatformTarget, ServiceMap } from "../interface.js"

export default {
	async openDB(location, models) {
		throw new Error("Unsupported platform")
	},

	async openGossipLog(location, init) {
		throw new Error("Unsupported platform")
	},

	async createLibp2p(messageLog, config): Promise<Libp2p<ServiceMap>> {
		throw new Error("Unsupported platform")
	},
} satisfies PlatformTarget
