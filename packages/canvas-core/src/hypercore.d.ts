declare module "hypercore" {
	import type { RandomAccessStorage } from "random-access-storage"

	interface HypercoreOptions {
		createIfMissing: boolean
		overwrite: boolean
		valueEncoding: "json" | "utf-8" | "binary"
	}

	class Feed {
		length: number
		on(event: "ready", callback: () => void): void
		append(data: any, callback: (err: null | Error, seq: number) => void): void
		get(index: number, callback: (err: null | Error, data: any) => void): void
		getBatch(start: number, end: number, callback: (err: null | Error, data: any[]) => void): void
		close(callback: (err: null | Error) => void): void
	}

	export default function hypercore(
		storage: string | ((file: string) => RandomAccessStorage),
		options?: Partial<HypercoreOptions>
	): Feed
}
