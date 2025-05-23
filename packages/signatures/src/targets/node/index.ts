import os from "node:os"
import { createHash } from "node:crypto"

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

	*keys(prefix: string = ""): IterableIterator<string> {
		for (const key of cache.keys()) {
			if (key.startsWith(prefix)) {
				yield key
			}
		}
	},

	*entries(prefix: string = ""): IterableIterator<[string, string]> {
		for (const [key, value] of cache.entries()) {
			if (key.startsWith(prefix)) {
				yield [key, value]
			}
		}
	},

	getDomain(): string {
		return os.hostname()
	},

	sha256(input: Uint8Array | Iterable<Uint8Array>): Uint8Array {
		const hash = createHash("sha256")
		if (input instanceof Uint8Array) {
			hash.update(input)
		} else {
			for (const chunk of input) {
				hash.update(chunk)
			}
		}

		const digest = hash.digest()
		return new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength)
	},
} satisfies PlatformTarget
