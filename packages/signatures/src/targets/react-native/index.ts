import type { PlatformTarget } from "../index.js"

const cache = new Map<string, string>()

export default {
	get(key: string): string | null {
		return cache.get(key) ?? null
	},
	set(key: string, value: any) {
		cache.set(key, value)
	},

	clear(prefix: string = "") {
		for (const key of cache.keys()) {
			if (key.startsWith(prefix)) {
				cache.delete(key)
			}
		}
	},

	getDomain() {
		return "react-native-application"
	},
} satisfies PlatformTarget
