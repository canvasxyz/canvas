declare module "hyperbee" {
	import type { Feed } from "hypercore"
	import type stream from "node:stream"

	interface HyperBeeOptions {
		keyEncoding: "utf-8" | "binary" | "ascii"
		valueEncoding: "utf-8" | "binary" | "ascii"
	}

	type Key = string | Uint8Array
	type Value = string | Uint8Array

	interface Batch {
		put(key: Key, value?: Value): Promise<void>
		get(key: Key): Promise<null | { seq: number; key: Key; value: Value }>
		del(key: Key): Promise<void>
		flush(): Promise<void>
		destroy(): void
	}

	interface CreateReadStreamOptions {
		gt: Key
		gte: Key
		lt: Key
		lte: Key
		reverse: boolean
		limit: number
	}

	interface CreateHistoryStreamOptions {
		live: boolean
		reverse: boolean
		gte: number
		gt: number
		lte: number
		lt: number
		limit: number
	}

	interface CreateDiffStreamOptions {
		gt: Key
		gte: Key
		lt: Key
		lte: Key
		reverse: boolean
		limit: number
	}

	export default class HyperBee {
		constructor(feed: Feed, options?: HyperBeeOptions)

		version: number

		put(key: Key, value?: Value): Promise<void>
		get<K extends Key = Key, V extends Value = Value>(key: K): Promise<null | { seq: number; key: K; value: V }>
		del(key: Key): Promise<void>
		batch(): Batch
		ready(): Promise<void>
		checkout(version: number): HyperBee

		createReadStream<K extends Key = Key, V extends Value = Value>(
			options?: Partial<CreateReadStreamOptions>
		): stream.Readable & AsyncIterable<{ seq: number; key: K; value: V }>

		createHistoryStream<K extends Key = Key, V extends Value = Value>(
			options?: Partial<CreateHistoryStreamOptions>
		): stream.Readable &
			AsyncIterable<{ type: "put"; seq: number; key: K; value: V } | { type: "del"; seq: number; key: K; value: null }>

		createDiffStream<K extends Key = Key, V extends Value = Value>(
			otherVersion: HyperBee,
			options?: Partial<CreateDiffStreamOptions>
		): stream.Readable & AsyncIterable<{ seq: number; key: K; value: { left: V | null; right: V | null } }>
	}
}
