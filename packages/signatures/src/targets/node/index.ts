import os from "node:os"

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
	keys(prefix?: string): string[] {
		const results: string[] = []
		for (const key of cache.keys()) {
			if (!prefix || key.startsWith(prefix)) results.push(key)
		}
		return results
	},
	getAll(prefix?: string): string[] {
		const results: string[] = []
		for (const [key, value] of cache.entries()) {
			if (!prefix || key.startsWith(prefix)) results.push(value)
		}
		return results
	},
	getFirst(prefix?: string): string | null {
		for (const [key, value] of cache.entries()) {
			if (!prefix || key.startsWith(prefix)) return value
		}
		return null
	},

	getDomain() {
		return os.hostname()
	},
} satisfies PlatformTarget
