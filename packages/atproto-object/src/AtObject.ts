import debug from "weald"
import PQueue from "p-queue"

import { ModelDB as SqliteModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { AbstractModelDB } from "@canvas-js/modeldb"
import { mapValues } from "@canvas-js/utils"

import type { AtConfig, AtInit } from "./types.js"
import { getConfig } from "./utils/utils.js"
import { Relay } from "./relay/relay.js"

// Enable debug namespace programmatically
if (!process.env.DEBUG) {
	process.env.DEBUG = "atobject:*"
}

export class AtObject {
	public db: AbstractModelDB
	public firstSeq: number | null
	public lastSeq: number | null
	public config: Record<string, AtConfig>
	public wantedCollections: string[]
	public handlerQueue: PQueue
	public relay: Relay

	private trace: typeof debug.log
	private log: typeof debug.log

	static async initialize(init: AtInit, path: string | null) {
		const config = getConfig(init)

		const dbConfig = {
			models: mapValues(config, () => ({ rkey: "primary", record: "json" }) as const),
			version: {
				atobject: 1,
			},
			// TODO: do we need an initial upgrade?
			upgrade: undefined,
			initialUpgradeVersion: undefined,
			initialUpgradeSchema: undefined,
			reset: true,
		}

		if (path?.startsWith("postgres://")) {
			const db = await PostgresModelDB.open(path, dbConfig)
			return new AtObject(config, db)
		} else {
			const db = await SqliteModelDB.open(path, dbConfig)
			return new AtObject(config, db)
		}
	}

	static async getCurrentCursor(endpoint = "wss://bsky.network", timeout = 10000): Promise<number> {
		return Relay.getCurrentCursor(endpoint, timeout)
	}

	private constructor(config: Record<string, AtConfig>, db: AbstractModelDB) {
		this.firstSeq = null
		this.lastSeq = null
		this.config = config
		this.wantedCollections = Object.values(config).map((config) => config.nsid)
		this.db = db
		this.trace = debug("atobject:trace")
		this.log = (message: string, ...args: any[]) => {
			console.log(`[atobject] ${message}`, ...args)
		}
		this.handlerQueue = new PQueue({ concurrency: 1 })
		this.relay = new Relay(this)
	}

	listen(
		endpoint: string,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	) {
		this.relay.listen(endpoint, options)
	}

	async backfill(
		endpoint: string,
		cursor: string | number,
		options: {
			onError?: (error: Error) => void
			onConnect?: () => void
			onDisconnect?: () => void
		} = {},
	): Promise<void> {
		return this.relay.backfill(endpoint, cursor, options)
	}

	public createDbProxy(table: string) {
		return {
			set: (key: string, record: any) => {
				this.trace(`DB SET ${table}: %O`, record)
				return this.db.set(table, record)
			},
			get: (key: string) => {
				this.trace(`DB GET ${table}.${key}`)
				return this.db.get(table, key)
			},
			delete: (key: string) => {
				this.trace(`DB DELETE ${table}.${key}`)
				return this.db.delete(table, key)
			},
		}
	}

	public async backfillUsers(identifiers: string[]): Promise<void> {
		return this.relay.backfillUsers(identifiers)
	}

	close() {
		this.relay.close()
		this.handlerQueue.clear()
	}
}
