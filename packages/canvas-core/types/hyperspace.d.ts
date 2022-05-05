declare module "hyperspace" {
	import type { Feed, HypercoreOptions } from "hypercore"
	import type { RandomAccessStorage } from "random-access-storage"
	import type stream from "node:stream"

	interface RemoteHypercoreOptions {
		key?: string
		createIfMissing?: boolean
		overwrite?: boolean
		valueEncoding?: "json" | "utf-8" | "binary"
	}
	class CoreStore {
		get(options: RemoteHypercoreOptions): Feed
	}

	/**
	 * Hyperspace client
	 */
	interface ClientOptions {
		host?: string
		port?: number | string
	}

	export class Client {
		constructor(options: ClientOptions)
		get(options: RemoteHypercoreOptions): Feed

		corestore(): CoreStore
	}

	/**
	 * Hyperspace server
	 */
	interface ServerOptions {
		storage: string | ((file: string) => RandomAccessStorage)
		host?: string
		port?: string | number
	}

	export class Server {
		constructor(options?: ServerOptions)

		ready(): Promise<void>
		networker: any
		on(event: "client-open" | "client-close", callback: (data: any) => void): Server
	}
}
