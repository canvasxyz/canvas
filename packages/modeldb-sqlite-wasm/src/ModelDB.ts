/// <reference lib="webworker" />

import sqlite3InitModule, { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm"

import {
	AbstractModelDB,
	ModelDBBackend,
	Config,
	Effect,
	ModelValue,
	QueryParams,
	WhereCondition,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
	Model,
	ModelDBInit,
} from "@canvas-js/modeldb"
import { signalInvalidType } from "@canvas-js/utils"

import { ModelAPI } from "./ModelAPI.js"
import { Query } from "./utils.js"

export interface ModelDBOptions {
	sqlite3?: Sqlite3Static
}

const isWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	#selectTable: Query<[string], { name: string }>
	#selectIndex: Query<[string, string], { name: string }>

	public static async open(path: string | null, init: ModelDBInit, { sqlite3 }: ModelDBOptions = {}) {
		sqlite3 ??= await sqlite3InitModule({ print: console.log, printErr: console.error })

		const newConfig = Config.parse(init.models, { freeze: true })
		const newVersion = Object.assign(init.version ?? {}, AbstractModelDB.baseVersion)

		let db: Database
		if (path === null || path === undefined) {
			db = new sqlite3.oo1.DB(":memory:")
		} else if (isWorker) {
			if ("opfs" in sqlite3) {
				db = new sqlite3.oo1.OpfsDb(path, "c")
			} else {
				throw new Error("cannot open persistent database: missing OPFS API support")
			}
		} else {
			throw new Error("cannot open persistent database: persistent databases are only available in worker threads")
		}

		const timestamp = new Date().toISOString()

		// calling this constructor will create empty $versions and $models
		// tables if they do not already exist
		const baseModelDB = new ModelDB(sqlite3, db, Config.baseConfig, AbstractModelDB.baseVersion)
		const versionRecordCount = await baseModelDB.count("$versions")
		if (versionRecordCount === 0) {
			// this means one of two things:
			// 1) we are initializing a new database, or
			// 2) we are opening a pre-migration-system database for the first time

			baseModelDB.log("no version records found")
			const initialUpgradeVersion = Object.assign(
				init.initialUpgradeVersion ?? init.version ?? {},
				AbstractModelDB.baseVersion,
			)
			const initialUpgradeConfig = init.initialUpgradeSchema ? Config.parse(init.initialUpgradeSchema) : newConfig

			// we distinguish between these cases using baseModelDB.satisfies(...).
			const isSatisfied = await baseModelDB.satisfies(initialUpgradeConfig)
			if (isSatisfied) {
				baseModelDB.log("existing database satisfies initial upgrade config")
				// now we write initialUpgradeConfig entries to $models
				// and write initialUpgradeVersion entries to $versions
				await AbstractModelDB.initialize(baseModelDB, timestamp, initialUpgradeVersion, initialUpgradeConfig)
			} else {
				baseModelDB.log("existing database not satisfied by initial upgrade config")
				// we ignore initialUpgradeVersion / initialUpgradeConfig and just
				// initialize directly with newVersion / newConfig
				await AbstractModelDB.initialize(baseModelDB, timestamp, newVersion, newConfig)
			}
		}

		// now means we proceed with the regular upgrade check
		await AbstractModelDB.upgrade(baseModelDB, timestamp, newVersion, newConfig, async (oldConfig, oldVersion) => {
			if (init.upgrade !== undefined) {
				const existingDB = new ModelDB(sqlite3, db, oldConfig, oldVersion)
				const upgradeAPI = existingDB.getUpgradeAPI()
				await init.upgrade(upgradeAPI, oldConfig, oldVersion, newVersion)
			}
		})

		return new ModelDB(sqlite3, db, newConfig, newVersion)
	}

	private constructor(
		public readonly sqlite3: Sqlite3Static,
		public readonly db: Database,
		config: Config,
		version: Record<string, number>,
	) {
		super(config, version)
		this.log("Running SQLite3 version %s", sqlite3.version.libVersion)

		this.#selectTable = new Query(db, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?`)
		this.#selectIndex = new Query(
			db,
			`SELECT name FROM sqlite_schema WHERE type = 'index' AND name = ? AND tbl_name = ?`,
		)

		for (const model of Object.values(this.config.models)) {
			this.#models[model.name] = new ModelAPI(this.db, this.config, model)
		}
	}

	protected hasModel(model: Model): boolean {
		const tableName = model.name
		if (this.#selectTable.get([tableName]) === null) {
			return false
		}

		for (const index of model.indexes) {
			const indexName = [model.name, ...index].join("/")
			if (this.#selectIndex.get([indexName, tableName]) === null) {
				return false
			}
		}

		return true
	}

	public getType(): ModelDBBackend {
		return "sqlite-wasm"
	}

	public async close() {
		this.db.close()
	}

	public async apply(effects: Effect[]) {
		this.db.transaction(() => {
			for (const effect of effects) {
				const model = this.#models[effect.model]
				if (model === undefined) {
					throw new Error(`model ${effect.model} not found`)
				}

				if (effect.operation === "set") {
					this.#models[effect.model].set(effect.value)
				} else if (effect.operation === "delete") {
					this.#models[effect.model].delete(effect.key)
				} else {
					signalInvalidType(effect)
				}
			}

			for (const { model, query, filter, callback } of this.subscriptions.values()) {
				if (effects.some(filter)) {
					const api = this.#models[model]
					if (api === undefined) {
						throw new Error(`model ${model} not found`)
					}

					try {
						const results = api.query(query)
						Promise.resolve(callback(results)).catch((err) => this.log.error(err))
					} catch (err) {
						this.log.error(err)
					}
				}
			}
		})
	}

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.get(key) as T | null
	}

	public async getAll<T extends ModelValue>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getAll() as T[]
	}

	public async getMany<T extends ModelValue>(modelName: string, keys: string[]): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getMany(keys) as (T | null)[]
	}

	public async count(modelName: string, where?: WhereCondition): Promise<number> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.count(where)
	}

	public async clear(modelName: string): Promise<void> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.clear()
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.query(query) as T[]
	}

	public async *iterate<T extends ModelValue = ModelValue>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		for await (const value of api.iterate(query)) {
			yield value as T
		}
	}

	private createModel(name: string, init: ModelInit) {
		const model = this.config.createModel(name, init)
		this.models[name] = model
		this.#models[name] = new ModelAPI(this.db, this.config, model)
		this.#models.$models.set({ name, model })
	}

	private deleteModel(name: string) {
		this.config.deleteModel(name)
		this.#models[name].drop()
		delete this.#models[name]
		delete this.models[name]
		this.#models.$models.delete(name)
	}

	private addProperty(modelName: string, propertyName: string, propertyType: PropertyType) {
		const property = this.config.addProperty(modelName, propertyName, propertyType)
		throw new Error("not implemented")
	}

	private removeProperty(modelName: string, propertyName: string) {
		this.config.removeProperty(modelName, propertyName)
		throw new Error("not implemented")
	}

	private addIndex(modelName: string, index: string) {
		const propertyNames = this.config.addIndex(modelName, index)
		throw new Error("not implemented")
	}

	private removeIndex(modelName: string, index: string) {
		this.config.removeIndex(modelName, index)
		throw new Error("not implemented")
	}

	private getUpgradeAPI() {
		return {
			get: this.get.bind(this),
			getAll: this.getAll.bind(this),
			getMany: this.getMany.bind(this),
			iterate: this.iterate.bind(this),
			query: this.query.bind(this),
			count: this.count.bind(this),
			clear: this.clear.bind(this),
			apply: this.apply.bind(this),
			set: this.set.bind(this),
			delete: this.delete.bind(this),

			createModel: this.createModel.bind(this),
			deleteModel: this.deleteModel.bind(this),
			addProperty: this.addProperty.bind(this),
			removeProperty: this.removeProperty.bind(this),
			addIndex: this.addIndex.bind(this),
			removeIndex: this.removeIndex.bind(this),
		} satisfies DatabaseUpgradeAPI
	}
}
