import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openDB(location, models) {
		throw new Error("Unsupported platform")
	},

	async openGossipLog(location, init) {
		throw new Error("Unsupported platform")
	},

	async createLibp2p(config, messageLog) {
		throw new Error("Unsupported platform")
	},
}

export default target
