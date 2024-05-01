import type { PlatformTarget } from "../index.js"

export default {
	getSignerStore(options: {}) {
		throw new Error("unsupported platform")
	},
	get(key: string) {
		throw new Error("unsupported platform")
	},
	set(key: string, value: string) {
		throw new Error("unsupported platform")
	},
	clear(prefix?: string) {
		throw new Error("unsupported platform")
	},
	getDomain() {
		throw new Error("unsupported platform")
	},
} satisfies PlatformTarget
