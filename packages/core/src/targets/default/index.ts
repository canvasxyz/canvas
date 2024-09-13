import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openGossipLog(location, init) {
		throw new Error("Unsupported platform")
	},

	async connect(gossipLog, url, signal) {
		throw new Error("Unsupported platform")
	},

	async listen(gossipLog, port, signal) {
		throw new Error("Unsupported platform")
	},
}

export default target
