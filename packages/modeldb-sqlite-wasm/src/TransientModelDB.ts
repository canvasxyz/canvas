import { logger } from "@libp2p/logger"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import {
	AbstractModelDB,
	parseConfig,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	Config,
	getFilter,
} from "@canvas-js/modeldb"
import { InnerModelDB } from "./InnerModelDB.js"
import { Awaitable } from "@canvas-js/interfaces"
import assert from "assert"

export interface ModelDBOptions {
	path: string
	models: ModelSchema
}

export class TransientModelDB extends AbstractModelDB {
	private readonly wrappedDB: InnerModelDB

	public static async initialize({ models }: ModelDBOptions) {
		const config = parseConfig(models)
		const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error })
		const db = new sqlite3.oo1.DB()
		const log = logger("canvas:modeldb:transient")
		const wrappedDB = new InnerModelDB(db, config, log)
		return new TransientModelDB({ wrappedDB, config })
	}

	private constructor({ wrappedDB, config }: { wrappedDB: InnerModelDB; config: Config }) {
		super(config)
		this.wrappedDB = wrappedDB
	}

	public async close() {
		this.log("closing")
		this.wrappedDB.close()
	}

	public async apply(effects: Effect[]) {
		this.wrappedDB.apply(effects)
		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				try {
					const queryRes = this.wrappedDB.query(model, query)
					callback(queryRes)
				} catch (err) {
					console.error(err)
				}
			}
		}
	}

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		return Promise.resolve(this.wrappedDB.get(modelName, key)) as Promise<T | null>
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		return this.wrappedDB.iterate(modelName)
	}

	public async count(modelName: string): Promise<number> {
		return this.wrappedDB.count(modelName)
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		return Promise.resolve(this.wrappedDB.query(modelName, query)) as Promise<T[]>
	}
}
