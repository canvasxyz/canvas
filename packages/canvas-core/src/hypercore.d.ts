declare module "hypercore" {
	interface HypercoreOptions {
		createIfMissing: boolean
		overwrite: boolean
		valueEncoding: "json" | "utf-8" | "binary"
	}

	type DataCallback = (err: null | Error, data: any) => void

	class Feed {
		length: number
		byteLength: number
		on(
			event:
				| "ready"
				| "error"
				| "download"
				| "upload"
				| "append"
				| "sync"
				| "close"
				| "peer-add"
				| "peer-remove"
				| "peer-open",
			callback: (err?) => void
		): Feed
		append(data: any, callback: (err: null | Error, seq: number) => void): void
		get(index: number, callback?: DataCallback): void
		getBatch(start: number, end: number, callback: (err: null | Error, data: any[]) => void): void
		cancel(getId): void
		head(callback?: DataCallback): void
		download(start, end): any
		undownload(downloadId: number): void

		close(callback: (err: null | Error) => void): void

		key: Buffer | null
		discoveryKey: Buffer | null
		opened: boolean
		sparse: boolean
		writable: boolean

		peers: number
	}

	export default function hypercore(storage: string, options?: Partial<HypercoreOptions>): Feed
}
