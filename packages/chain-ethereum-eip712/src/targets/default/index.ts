import type { PlatformTarget } from "../index.js"

export default {
	getSessionStore() {
		throw new Error("unsupported platform")
	},
	getRandomValues() {
		throw new Error("unsupported platform")
	},
} satisfies PlatformTarget
