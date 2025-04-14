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
	keys(prefix?: string): string[] {
		const result: string[] = []
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (key === null) break
			if (!prefix || key.startsWith(prefix)) {
				result.push(key)
			}
		}
		return result
	},
	getAll(prefix?: string): string[] {
		const result: string[] = []
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (key === null) break
			if (!prefix || key.startsWith(prefix)) {
				const item = window.localStorage.getItem(key)
				if (item !== null) result.push(item)
			}
		}
		return result
	},
	getFirst(prefix?: string): string | null {
		return this.getAll(prefix)[0] ?? null
	},

	getDomain() {
		return window.location.host
	},
} satisfies PlatformTarget
