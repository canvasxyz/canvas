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

	getDomain() {
		return "react-native-application"
	},
} satisfies PlatformTarget
