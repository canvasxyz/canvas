import type { PlatformTarget } from "../index.js"

import { MMKV } from "react-native-mmkv"

export const storage = new MMKV()

export default {
	get(key: string): string | null {
		return storage.getString(key) ?? null
	},
	set(key: string, value: string) {
		storage.set(key, value)
	},
	clear(prefix: string = "") {
		for (const key of storage.getAllKeys()) {
			if (key?.startsWith(prefix)) {
				storage.delete(key)
			}
		}
	},
	keys(prefix?: string): string[] {
		const response: string[] = []
		for (const key of storage.getAllKeys()) {
			if (!prefix || key.startsWith(prefix)) {
				response.push(key)
			}
		}
		return response
	},
	getAll(prefix?: string): string[] {
		const response: string[] = []
		for (const key of storage.getAllKeys()) {
			if (!prefix || key.startsWith(prefix)) {
				const value = storage.getString(key)
				if (value !== undefined) response.push(value)
			}
		}
		return response
	},
	getFirst(prefix?: string): string | null {
		return this.getAll(prefix)[0] ?? null
	},

	getDomain() {
		return "react-native-application"
	},
} satisfies PlatformTarget
