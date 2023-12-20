import type { PlatformTarget } from "../index.js"

export default {
	getDomain() {
		throw new Error("unsupported platform")
	},
	getSessionStore() {
		throw new Error("unsupported platform")
	},
	getRandomValues() {
		throw new Error("unsupported platform")
	},
} satisfies PlatformTarget
