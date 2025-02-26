import { IDBPDatabase, IDBPTransaction, openDB } from "idb"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	AbstractModelDB,
	ModelDBBackend,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
	PrimaryKeyValue,
	Config,
	getModelsFromInclude,
	Model,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
} from "@canvas-js/modeldb"

import { ModelAPI } from "./api.js"
import { getIndexName, checkForMissingObjectStores } from "./utils.js"

export interface ModelDBOptions {
	name: string
	models: ModelSchema

	version?: Record<string, number>
	upgrade?: (
		db: DatabaseUpgradeAPI,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) => void | Promise<void>
}

export class ModelDB extends AbstractModelDB {
	public static async initialize({ name, models, version, upgrade }: ModelDBOptions) {
		const newConfig = Config.parse(models)
		const newVersion = Object.assign(version ?? {}, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		const sum = Object.values(version ?? {}).reduce((sum, value) => sum + value, 0)
		const db = await openDB(name, sum, {
			async upgrade(db: IDBPDatabase<unknown>) {
				// create missing object stores
				const storeNames = new Set(db.objectStoreNames)

				for (const [name, model] of Object.entries(Config.baseModels)) {
					if (!storeNames.has(name)) {
						ModelDB.createModel(db, model)
					}
				}

				const baseModelDB = new ModelDB(db, Config.baseConfig)
				await baseModelDB.initialize(newConfig, newVersion, async (oldConfig, oldVersion) => {
					if (upgrade !== undefined) {
						const existingDB = new ModelDB(db, oldConfig)
						const upgradeAPI = existingDB.getUpgradeAPI()
						await upgrade(upgradeAPI, oldVersion, newVersion)
					}
				})
			},
		})

		return new ModelDB(db, newConfig)
	}

	private static getKeyPath = (index: string[]) => (index.length === 1 ? index[0] : index)

	private static createModel(db: IDBPDatabase<unknown>, model: Model) {
		const keyPath = ModelDB.getKeyPath(model.primaryKey)
		const recordObjectStore = db.createObjectStore(model.name, { keyPath })

		for (const index of model.indexes) {
			const keyPath = ModelDB.getKeyPath(index)
			recordObjectStore.createIndex(getIndexName(index), keyPath)
		}
	}

	readonly #models: Record<string, ModelAPI> = {}

	public getType(): ModelDBBackend {
		return "idb"
	}

	private constructor(public readonly db: IDBPDatabase, config: Config) {
		super(config)

		for (const model of config.models) {
			this.#models[model.name] = new ModelAPI(model)
		}

		db.addEventListener("error", (event) => this.log("db: error", event))
		db.addEventListener("close", (event) => this.log("db: close", event))
		db.addEventListener("versionchange", (event) => {
			this.log("db: versionchange", event)
			if (event.oldVersion === null && event.newVersion !== null) {
				// create
				return
			} else if (event.oldVersion !== null && event.newVersion !== null) {
				// update
				return
			} else if (event.oldVersion !== null && event.newVersion === null) {
				// delete
				db.close()
				return
			}
		})
	}

	public async close() {
		this.log("closing")
		this.db.close()
	}

	private async read<T>(
		fn: (txn: IDBPTransaction<any, any, "readonly">) => T | Promise<T>,
		objectStoreNames: string[] = [...this.db.objectStoreNames],
	) {
		checkForMissingObjectStores(this.db, objectStoreNames)
		const txn = this.db.transaction(objectStoreNames, "readonly")
		return await fn(txn)
	}

	private async write<T>(fn: (txn: IDBPTransaction<any, any, "readwrite">) => Promise<T>): Promise<T> {
		let txn: IDBPTransaction<any, any, "readwrite"> | null = null

		try {
			txn = this.db.transaction(this.db.objectStoreNames, "readwrite")
			// we have to use Promise.all here, not sure why this works
			// otherwise we get an unthrowable AbortError
			// it might be because if a transaction fails, idb doesn't know if there are any
			// more database operations that would have been performed in the transaction
			// this is just a post hoc rationalisation though
			// https://github.com/jakearchibald/idb/issues/256#issuecomment-1048551626
			const [res, _] = await Promise.all([fn(txn), txn.done])
			return res
		} catch (e) {
			txn?.abort()
			throw e
		}
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)

		// TODO: re-open the transaction if the caller awaits on other promises between yields
		checkForMissingObjectStores(this.db, [api.storeName])
		const txn = this.db.transaction([api.storeName], "readonly", {})
		yield* api.iterate(txn, query) as AsyncIterable<T>
	}

	public async get<T extends ModelValue>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Promise<T | null> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return await this.read((txn) => api.get(txn, key) as Promise<T | null>, [api.storeName])
	}

	public async getAll<T extends ModelValue>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return await this.read((txn) => api.getAll(txn) as Promise<T[]>, [api.storeName])
	}

	public async getMany<T extends ModelValue>(
		modelName: string,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return await this.read((txn) => api.getMany(txn, keys) as Promise<(T | null)[]>, [api.storeName])
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		if (query.include) {
			return this.queryWithInclude<T>(modelName, query)
		}

		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		const result = await this.read((txn) => api.query(txn, query), [api.storeName])
		return result as T[]
	}

	private async queryWithInclude<T extends ModelValue = ModelValue>(
		modelName: string,
		query: QueryParams = {},
	): Promise<T[]> {
		assert(query.include)
		const api = this.#models[modelName]
		const modelNames = Array.from(
			new Set([modelName, ...getModelsFromInclude(this.config.models, modelName, query.include)]),
		)
		for (const modelName of modelNames) {
			assert(this.#models[modelName] !== undefined, `model ${modelName} not found`)
		}

		const result = await this.read(
			async (txn) => api.queryWithInclude(txn, this.#models, query),
			modelNames.map((m: string) => this.#models[m].storeName),
		)

		return result as T[]
	}

	public async count(modelName: string, where?: WhereCondition): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		checkForMissingObjectStores(this.db, [api.storeName])

		return await this.read((txn) => api.count(txn, where), [api.storeName])
	}

	public async clear(modelName: string): Promise<void> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return await this.write((txn) => api.clear(txn))
	}

	public async apply(effects: Effect[]): Promise<void> {
		await this.write(async (txn) => {
			for (const effect of effects) {
				const api = this.#models[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				if (effect.operation === "set") {
					await api.set(txn, effect.value)
				} else if (effect.operation === "delete") {
					await api.delete(txn, effect.key)
				} else {
					signalInvalidType(effect)
				}
			}

			await Promise.all(
				[...this.subscriptions.values()].map(async ({ model, query, filter, callback }) => {
					const api = this.#models[model]
					assert(api !== undefined, `model ${model} not found`)
					if (effects.some((effect) => filter(effect))) {
						try {
							// const results = query.include
							// 	? await api.queryWithInclude(txn, this.#models, query)
							// 	: await api.query(txn, query)
							const results = await api.query(txn, query)
							await callback(results)
						} catch (err) {
							this.log.error(err)
						}
					}
				}),
			)
		})
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

			createModel: async (name: string, init: ModelInit) => {
				const model = this.config.createModel(name, init)
				this.models[name] = model
				this.#models[name] = new ModelAPI(model)
				await this.write((txn) => this.#models.$models.set(txn, { name, model }))
			},

			deleteModel: async (name: string) => {
				this.config.deleteModel(name)
				delete this.#models[name]
				delete this.models[name]
				await this.write((txn) => this.#models.$models.delete(txn, name))
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
