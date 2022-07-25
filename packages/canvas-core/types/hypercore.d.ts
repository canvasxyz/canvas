// declare module "hypercore" {
// 	import type { RandomAccessStorage } from "random-access-storage"

// 	namespace Feed {
// 		interface GetOptions {
// 			wait: boolean
// 			onwait: () => void
// 			timeout: number
// 			valueEncoding: "json" | "utf-8" | "binary"
// 		}

// 		interface GetBatchOptions {
// 			wait: boolean
// 			timeout: number
// 			valueEncoding: "json" | "utf-8" | "binary"
// 		}

// 		interface CreateReadStreamOptions {
// 			start: number
// 			end: number
// 			snapshot: boolean
// 			tail: boolean
// 			live: boolean
// 			timeout: number
// 			wait: boolean
// 			batch: number
// 		}

// 		interface CreateWriteStreamOptions {
// 			maxBlockSize: number
// 		}

// 		interface ReplicateOptions {
// 			live: boolean
// 			ack: boolean
// 			download: boolean
// 			upload: boolean
// 			encrypted: boolean
// 			noise: boolean
// 			keyPair: { publicKey: Buffer; secretKey: Buffer }
// 			onauthenticate: (remotePublicKey: Buffer, done: (err: null | Error) => void) => void
// 			onfeedauthenticate: (feed: Feed, remotePublicKey: Buffer, done: (err: null | Error) => void) => void
// 		}

// 		interface Extension {
// 			send(message: any, peer: Peer): void
// 			broadcast(message: any): void
// 		}
// 	}

// 	type Peer = string

// 	export class Feed {
// 		private constructor()

// 		append(data: any, callback?: (err: null | Error, seq: number) => void): void

// 		get(index: number, callback: (err: null | Error, data: any) => void): number
// 		get(index: number, options: Partial<Feed.GetOptions>, callback: (err: null | Error, data: any) => void): number

// 		getBatch(
// 			start: number,
// 			end: number,
// 			options: Partial<Feed.GetBatchOptions>,
// 			callback: (err: null | Error, data: any[]) => void
// 		): void
// 		getBatch(start: number, end: number, callback: (err: null | Error, data: any[]) => void): void

// 		cancel(getId: number): void

// 		head(callback: (err: null | Error, data: any) => void): void
// 		head(options: Partial<Feed.GetOptions>, callback: (err: null | Error, data: any) => void): void

// 		download(
// 			range: { start: number; end: number; linear: boolean } | { blocks: number[] },
// 			callback?: (err: null | Error) => void
// 		): number
// 		download(callback?: (err: null | Error) => void): number

// 		undownload(downloadId: number): void

// 		signature(
// 			index: number,
// 			callback: (err: null | Error, signature: { index: number; signature: Buffer }) => void
// 		): void
// 		signature(callback: (err: null | Error, signature: { index: number; signature: Buffer }) => void): void

// 		verify(index: number, signature: Buffer, callback: (err: null | Error, success: boolean) => void): void

// 		rootHashes(
// 			index: number,
// 			callback: (err: null | Error, roots: { index: number; size: number; hash: Buffer }[]) => void
// 		): void

// 		downloaded(start?: number, end?: number): number

// 		has(index: number): boolean
// 		has(start: number, end: number): boolean

// 		clear(start: number, end: number, callback?: (err: null | Error) => void): void
// 		clear(start: number, callback?: (err: null | Error) => void): void

// 		seek(byteOffset: number, callback: (err: null | Error, index: number, relativeOffset: number) => void): void

// 		update(minLength: number, callback?: (err: null | Error) => void): void
// 		update(options: { ifAvailable: boolean; minLength: number }, callback?: (err: null | Error) => void): void
// 		update(callback?: (err: null | Error) => void): void

// 		setDownloading(downloading: boolean): void

// 		setUploading(uploading: boolean): void

// 		createReadStream(options?: Partial<Feed.CreateReadStreamOptions>): NodeJS.ReadableStream

// 		createWriteStream(options?: Partial<Feed.CreateWriteStreamOptions>): NodeJS.WritableStream

// 		replicate(isInitiator: boolean, options?: Partial<Feed.ReplicateOptions>): NodeJS.ReadWriteStream

// 		on(event: "ack", callback: (ack: { start: number; length: number }) => void): Feed

// 		close(callback?: (err: null | Error) => void): void

// 		destroyStorage(callback?: (err: null | Error) => void): void

// 		audit(callback: (audit: { valid: number; invalid: number }) => void): void

// 		writable: boolean
// 		readable: boolean

// 		key: Buffer | null
// 		discoveryKey: Buffer | null
// 		length: number
// 		byteLength: number

// 		stats: {
// 			totals: {
// 				uploadedBytes: number
// 				uploadedBlocks: number
// 				downloadedBytes: number
// 				downloadedBlocks: number
// 			}
// 			peers: {
// 				uploadedBytes: number
// 				uploadedBlocks: number
// 				downloadedBytes: number
// 				downloadedBlocks: number
// 			}[]
// 		}

// 		on(event: "peer-add", callback: (peer: Peer) => void): Feed
// 		on(event: "peer-remove", callback: (peer: Peer) => void): Feed
// 		on(event: "peer-open", callback: (peer: Peer) => void): Feed

// 		peers: Peer[]

// 		registerExtension(
// 			name: string,
// 			handlers: {
// 				encoding: "json" | "binary" | "utf-8"
// 				onmessage: (message: any, peer: Peer) => void
// 				onerror: (err: Error) => void
// 			}
// 		): Feed.Extension

// 		opened: boolean
// 		sparse: boolean

// 		on(event: "ready", callback: () => void): Feed
// 		on(event: "error", callback: (err: Error) => void): Feed
// 		on(event: "download", callback: (index: number, data: any) => void): Feed
// 		on(event: "upload", callback: (index: number, data: any) => void): Feed
// 		on(event: "append", callback: () => void): Feed
// 		on(event: "sync", callback: () => void): Feed
// 		on(event: "close", callback: () => void): Feed
// 	}

// 	interface HypercoreOptions {
// 		createIfMissing: boolean
// 		overwrite: boolean
// 		valueEncoding: "json" | "utf-8" | "binary"
// 		sparse: boolean
// 		eagerUpdate: boolean
// 		secretKey: Buffer
// 		storeSecretKey: boolean
// 		storageCacheSize: number
// 		onwrite: (index: number, data: any, peer: string, cb: () => void) => void
// 		stats: boolean
// 	}

// 	export default function hypercore(
// 		storage: string | ((file: string) => RandomAccessStorage),
// 		options?: Partial<HypercoreOptions>
// 	): Feed
// }
