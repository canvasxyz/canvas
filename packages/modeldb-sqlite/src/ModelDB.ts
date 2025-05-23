import Database, * as sqlite from "better-sqlite3"

import { assert, signalInvalidType } from "@canvas-js/utils"

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
	PrimaryKeyValue,
	Model,
	ModelDBInit,
	PropertyValue,
} from "@canvas-js/modeldb"

import { ModelAPI } from "./ModelAPI.js"
import { Query } from "./utils.js"

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	#transaction: sqlite.Transaction<(effects: Effect[]) => void>
	#selectTable: Query<[string], { name: string }>
	#selectIndex: Query<[string, string], { name: string }>

	public static async open(path: string | null, init: ModelDBInit): Promise<ModelDB> {
		const newConfig = Config.parse(init.models, { freeze: true })
		const newVersion = Object.assign(init.version ?? {}, AbstractModelDB.baseVersion)

		const timestamp = new Date().toISOString()

		const db = new Database(path ?? ":memory:")
		db.pragma("journal_mode = WAL")

		try {
			// calling this constructor will create empty $versions and $models
			// tables if they do not already exist
			const baseModelDB = new ModelDB(db, Config.baseConfig, AbstractModelDB.baseVersion)
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
					const existingDB = new ModelDB(db, oldConfig, oldVersion)
					const upgradeAPI = existingDB.getUpgradeAPI()
					await init.upgrade(upgradeAPI, oldConfig, oldVersion, newVersion)
				}
			})

			return new ModelDB(db, newConfig, newVersion)
		} catch (err) {
			db.close()
			throw err
		}
	}

	private constructor(public readonly db: sqlite.Database, config: Config, version: Record<string, number>) {
		super(config, version)

		this.#selectTable = new Query(db, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?`)
		this.#selectIndex = new Query(
			db,
			`SELECT name FROM sqlite_schema WHERE type = 'index' AND name = ? AND tbl_name = ?`,
		)

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, this.config, model)
		}

		this.#transaction = this.db.transaction((effects) => {
			for (const effect of effects) {
				const model = this.models[effect.model]
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
		})
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
		return this.db.memory ? "sqlite-memory" : "sqlite-disk"
	}

	public async close() {
		this.log("closing")
		this.db.close()
	}

	public async apply(effects: Effect[]) {
		this.#transaction(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				if (api === undefined) {
					throw new Error(`model ${model} not found`)
				}

				try {
					callback(api.query(query))
				} catch (err) {
					this.log.error(err)
				}
			}
		}
	}

	public async get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Promise<T | null> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.get(key) as T | null
	}

	public async getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getAll() as T[]
	}

	public async getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getMany(keys) as (T | null)[]
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		yield* api.iterate(query) as Iterable<T>
	}

	public async count(modelName: string, where?: WhereCondition): Promise<number> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.count(where)
	}

	public async clear(modelName: string) {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		api.clear()
	}

	public async query<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.query(query) as T[]
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

	private async addProperty(
		modelName: string,
		propertyName: string,
		propertyType: PropertyType,
		defaultPropertyValue: PropertyValue,
	) {
		const property = this.config.addProperty(modelName, propertyName, propertyType)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		this.#models[modelName].addProperty(property, defaultPropertyValue)
		this.#models.$models.set({ name: modelName, model })
	}

	private removeProperty(modelName: string, propertyName: string) {
		this.config.removeProperty(modelName, propertyName)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		this.#models[modelName].removeProperty(propertyName)
		this.#models.$models.set({ name: modelName, model })
	}

	private addIndex(modelName: string, index: string) {
		const propertyNames = Config.parseIndex(index)
		this.config.addIndex(modelName, index)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		this.#models[modelName].addIndex(propertyNames)
		this.#models.$models.set({ name: modelName, model })
	}

	private removeIndex(modelName: string, index: string) {
		const propertyNames = Config.parseIndex(index)
		this.config.removeIndex(modelName, index)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		this.#models[modelName].removeIndex(propertyNames)
		this.#models.$models.set({ name: modelName, model })
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
