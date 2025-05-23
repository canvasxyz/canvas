import { SHA256 } from "@noble/hashes/sha256"
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

	*keys(prefix: string = ""): IterableIterator<string> {
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (key?.startsWith(prefix)) {
				yield key
			}
		}
	},

	*entries(prefix: string = ""): IterableIterator<[string, string]> {
		for (const key of this.keys(prefix)) {
			const value = window.localStorage.getItem(key)
			if (value !== null) {
				yield [key, value]
			}
		}
	},

	getDomain(): string {
		return window.location.host
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

	// sha256: sha256,
} satisfies PlatformTarget
