import type { PlatformTarget } from "../index.js"

export default {
	getSessionStore() {
		throw new Error("unsupported platform")
	},
	saveJWTSession(data) {
		throw new Error("unsupported platform")
	},
	loadJWTSession() {
		throw new Error("unsupported platform")
	},
} satisfies PlatformTarget
