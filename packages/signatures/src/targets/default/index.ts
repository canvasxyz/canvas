import type { PlatformTarget } from "../index.js"

export default {
	get(key: string): string | null {
		throw new Error("unsupported platform")
	},
	set(key: string, value: string) {
		throw new Error("unsupported platform")
	},
	clear(prefix?: string) {
		throw new Error("unsupported platform")
	},
	*keys(prefix?: string): IterableIterator<string> {
		throw new Error("unsupported platform")
	},
	*entries(prefix?: string): IterableIterator<[string, string]> {
		throw new Error("unsupported platform")
	},
	getDomain(): string {
		throw new Error("unsupported platform")
	},
	sha256(input: Uint8Array): Uint8Array {
		throw new Error("unsupported platform")
	},
} satisfies PlatformTarget
