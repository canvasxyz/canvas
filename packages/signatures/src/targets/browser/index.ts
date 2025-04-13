import type { PlatformTarget } from "../index.js"

export default {
	get(key: string): string | null {
		return window.localStorage.getItem(key)
	},
	set(key: string, value: string) {
		window.localStorage.setItem(key, value)
	},
	clear(prefix: string = "") {
		const keyToRemove: string[] = []
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (key?.startsWith(prefix)) {
				keyToRemove.push(key)
			}
		}

		keyToRemove.forEach((key) => window.localStorage.removeItem(key))
	},
	getFirst(prefix?: string): string | null {
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (key === null) break
			if (!prefix || key.startsWith(prefix)) {
				return window.localStorage.getItem(key)
			}
		}
		return null
	},

	getDomain() {
		return window.location.host
	},
} satisfies PlatformTarget
