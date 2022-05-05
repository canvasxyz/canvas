declare module "random-access-storage" {
	import type EventEmitter from "node:events"
	import type { Buffer } from "node:buffer"

	export interface RandomAccessStorage extends EventEmitter {
		read(offset: number, size: number, cb?: (err: null | Error, data: null | Buffer) => void): void
		write(offset: number, data: Buffer, cb?: (err: null | Error) => void): void
		del(offset: number, size: number, cb?: (err: null | Error) => void): void
		stat(cb?: (options?: { size: number }) => void): void

		readable: boolean
		writable: boolean
		deletable: boolean
		statable: boolean

		open(cb?: (err: null | Error) => void): void
		close(cb?: (err: null | Error) => void): void
		destroy(cb?: (err: null | Error) => void): void

		opened: boolean
		closed: boolean
		destroyed: boolean
	}

	interface RandomAccessStorageOptions {
		read: (offset: number, size: number, cb?: (err: null | Error, data: null | Buffer) => void) => void
		write: (offset: number, data: Buffer, cb?: (err: null | Error) => void) => void
		del: (offset: number, size: number, cb?: (err: null | Error) => void) => void
		stat: (cb?: (options?: { size: number }) => void) => void
		open: (cb: (err: null | Error) => void) => void
		close: (cb?: (err: null | Error) => void) => void
		destroy: (cb?: (err: null | Error) => void) => void
	}

	export default function randomAccessStorage(options: Partial<RandomAccessStorageOptions>): RandomAccessStorage
}
