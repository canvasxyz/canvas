import { logger } from "@libp2p/logger"
import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import {
	Config,
	AbstractModelDB,
	ModelDBBackend,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
} from "@canvas-js/modeldb"
import { InnerModelDB } from "./InnerModelDB.js"
import "./worker.js"

export interface ModelDBOptions {
	path?: string
	models: ModelSchema
}

export class ModelDB extends AbstractModelDB {
	private readonly worker: Worker | null
	private readonly wrappedDB: Comlink.Remote<InnerModelDB> | InnerModelDB

	public static async initialize({ path, models }: ModelDBOptions) {
		const config = Config.parse(models)
		let worker, wrappedDB
		if (path) {
			worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" })
			const initializeDB = Comlink.wrap(worker) as any
			const logProxy = Comlink.proxy(logger("canvas:modeldb:worker"))
			wrappedDB = (await initializeDB(path, config, logProxy)) as Comlink.Remote<InnerModelDB>
		} else {
			worker = null
			const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error })
			const db = new sqlite3.oo1.DB()
			const log = logger("canvas:modeldb:transient")
			wrappedDB = new InnerModelDB(db, config, log)
		}

		return new ModelDB({ worker: worker, wrappedDB, config })
	}

	private constructor({
		worker,
		wrappedDB,
		config,
	}: {
		worker: Worker | null
		wrappedDB: Comlink.Remote<InnerModelDB> | InnerModelDB
		config: Config
	}) {
		super(config)
		this.worker = worker
		this.wrappedDB = wrappedDB
	}

	public getType(): ModelDBBackend {
		return "sqlite-wasm"
	}

	public async close() {
		this.log("closing")
		await this.wrappedDB.close()
		if (this.worker !== null) {
			this.worker.terminate()
		}
	}

	public async apply(effects: Effect[]) {
		await this.wrappedDB.apply(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				try {
					const queryRes = await this.query(model, query)
					callback(queryRes)
				} catch (err) {
					console.error(err)
				}
			}
		}
	}

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		// @ts-ignore
		return this.wrappedDB.get(modelName, key)
	}

	public async getMany<T extends ModelValue>(modelName: string, keys: string[]): Promise<(T | null)[]> {
		// @ts-ignore
		return this.wrappedDB.getMany(modelName, keys)
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(modelName: string): AsyncIterable<T> {
		return this.wrappedDB.iterate(modelName) as AsyncIterable<T>
	}

	public async count(modelName: string, where?: WhereCondition): Promise<number> {
		return this.wrappedDB.count(modelName, where)
	}

	public async clear(modelName: string): Promise<void> {
		return this.wrappedDB.clear(modelName)
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		// @ts-ignore
		return this.wrappedDB.query(modelName, query)
	}
}
