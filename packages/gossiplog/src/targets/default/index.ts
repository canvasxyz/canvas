import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async connect(gossipLog, url, options) {
		throw new Error("Unsupported platform")
	},

	async listen(gossipLog, port, options) {
		throw new Error("Unsupported platform")
	},

	async startLibp2p(gossipLog, config) {
		throw new Error("Unsupported platform")
	},
}

export default target
