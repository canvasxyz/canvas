import { logger } from "@libp2p/logger"
import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import { AbstractModelDB, parseConfig, Effect, ModelValue, ModelSchema, QueryParams, Config } from "@canvas-js/modeldb"
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
		const config = parseConfig(models)
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

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		return this.wrappedDB.iterate(modelName)
	}

	public async count(modelName: string): Promise<number> {
		return this.wrappedDB.count(modelName)
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		// @ts-ignore
		return this.wrappedDB.query(modelName, query)
	}
}
