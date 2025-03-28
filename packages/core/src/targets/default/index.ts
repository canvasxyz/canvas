import type { PlatformTarget } from "../interface.js"

const target: PlatformTarget = {
	async openGossipLog(location, init) {
		throw new Error("Unsupported platform")
	},

	async listen(app, port, options) {
		throw new Error("Unsupported platform")
	},

	buildContract(contract: string) {
		throw new Error("Unsupported platform")
	},

	buildContractByLocation(location: string) {
		throw new Error("Unsupported platform")
	},
}

export default target
