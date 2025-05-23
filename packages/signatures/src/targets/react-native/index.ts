import { MMKV } from "react-native-mmkv"
import { SHA256 } from "@noble/hashes/sha256"

import type { PlatformTarget } from "../index.js"

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

	*entries(prefix: string = ""): IterableIterator<[string, string]> {
		for (const key of this.keys(prefix)) {
			const value = storage.getString(key)
			if (value !== undefined) {
				yield [key, value]
			}
		}
	},

	*keys(prefix: string = ""): IterableIterator<string> {
		for (const key of storage.getAllKeys()) {
			if (key.startsWith(prefix)) {
				yield key
			}
		}
	},

	getDomain() {
		return "react-native-application"
	},

	sha256(input: Uint8Array | Iterable<Uint8Array>): Uint8Array {
		const hash = new SHA256()
		if (input instanceof Uint8Array) {
			hash.update(input)
		} else {
			for (const chunk of input) {
				hash.update(chunk)
			}
		}

		return hash.digest()
	},
} satisfies PlatformTarget
