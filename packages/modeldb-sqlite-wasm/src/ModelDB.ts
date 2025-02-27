/// <reference lib="webworker" />

import sqlite3InitModule, { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm"
import { logger } from "@libp2p/logger"
import {
	AbstractModelDB,
	ModelDBBackend,
	Config,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
	PrimaryKeyValue,
} from "@canvas-js/modeldb"
import { assert, signalInvalidType } from "@canvas-js/utils"

import { ModelAPI } from "./ModelAPI.js"

export interface ModelDBOptions {
	sqlite3?: Sqlite3Static
	path?: string | null
	models: ModelSchema

	version?: Record<string, number>
	upgrade?: (
		upgradeAPI: DatabaseUpgradeAPI,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) => void | Promise<void>
}

const isWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	protected readonly log = logger("canvas:modeldb")

	public static async open({ sqlite3, path, models, version, upgrade }: ModelDBOptions) {
		if (sqlite3 === undefined) {
			sqlite3 = await sqlite3InitModule({
				print: console.log,
				printErr: console.error,
			})
		}

		const newConfig = Config.parse(models)
		const newVersion = Object.assign(version ?? {}, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

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

		// calling this constructor will create empty $versions and $models
		// tables if they do not already exist
		const baseModelDB = new ModelDB(sqlite3, db, Config.baseConfig, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		await AbstractModelDB.initialize(baseModelDB, newConfig, newVersion, async (oldConfig, oldVersion) => {
			if (upgrade !== undefined) {
				const existingDB = new ModelDB(sqlite3, db, oldConfig, oldVersion)
				const upgradeAPI = existingDB.getUpgradeAPI()
				await upgrade(upgradeAPI, oldVersion, newVersion)
			}
		})

		newConfig.freeze()
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

		for (const model of Object.values(this.config.models)) {
			this.#models[model.name] = new ModelAPI(this.db, this.config, model)
		}
	}

	public getType(): ModelDBBackend {
		return "sqlite-wasm"
	}

	public close() {
		this.db.close()
	}

	public apply(effects: Effect[]) {
		this.db.transaction(() => {
			for (const effect of effects) {
				const model = this.#models[effect.model]
				assert(model !== undefined, `model ${effect.model} not found`)
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
					assert(api !== undefined, `model ${model} not found`)
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
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as T | null
	}

	public async getAll<T extends ModelValue>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getAll() as T[]
	}

	public async getMany<T extends ModelValue>(modelName: string, keys: string[]): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getMany(keys) as (T | null)[]
	}

	public async count(modelName: string, where?: WhereCondition): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count(where)
	}

	public async clear(modelName: string): Promise<void> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.clear()
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
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

			createModel: (name: string, init: ModelInit) => {
				const model = this.config.createModel(name, init)
				this.models[name] = model
				this.#models[name] = new ModelAPI(this.db, this.config, model)
				this.#models.$models.set({ name, model })
			},

			deleteModel: (name: string) => {
				this.config.deleteModel(name)
				this.#models[name].drop()
				delete this.#models[name]
				delete this.models[name]
				this.#models.$models.delete(name)
			},

			addProperty: (modelName: string, propertyName: string, propertyType: PropertyType) => {
				const property = this.config.addProperty(modelName, propertyName, propertyType)
				throw new Error("not implemented")
			},

			removeProperty: (modelName: string, propertyName: string) => {
				this.config.removeProperty(modelName, propertyName)
				throw new Error("not implemented")
			},

			addIndex: (modelName: string, index: string) => {
				const propertyNames = this.config.addIndex(modelName, index)
				throw new Error("not implemented")
			},

			removeIndex: (modelName: string, index: string) => {
				this.config.removeIndex(modelName, index)
				throw new Error("not implemented")
			},
		} satisfies DatabaseUpgradeAPI
	}
}
