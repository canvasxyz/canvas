declare module "hypercore" {
	interface HypercoreOptions {
		createIfMissing: boolean
		overwrite: boolean
		valueEncoding: "json" | "utf-8" | "binary"
	}

	class Feed {
		length: number
		on(event: "ready", callback: () => void)
		append(data: any, callback: (err: null | Error, seq: number) => void)
		get(index: number, callback: (err: null | Error, data: any) => void)
		getBatch(start: number, end: number, callback: (err: null | Error, data: any[]) => void)
		close(callback: (err: null | Error) => void)
	}

	export default function hypercore(storage: string, options?: Partial<HypercoreOptions>): Feed
}
