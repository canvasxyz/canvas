import { IDBPDatabase, IDBPTransaction, openDB } from "idb"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	AbstractModelDB,
	ModelDBBackend,
	Effect,
	ModelValue,
	QueryParams,
	WhereCondition,
	PrimaryKeyValue,
	Config,
	Model,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
	ModelDBInit,
	getModelsFromInclude,
} from "@canvas-js/modeldb"

import { ModelAPI } from "./ModelAPI.js"
import { getIndexName } from "./utils.js"

export class ModelDB extends AbstractModelDB {
	public static async open(name: string, init: ModelDBInit) {
		const newConfig = Config.parse(init.models, { freeze: true })
		const newVersion = Object.assign(init.version ?? {}, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		const sum = Object.values(newVersion).reduce((sum, value) => sum + value, 0)
		const db = await openDB(name, sum, {
			async upgrade(
				db: IDBPDatabase<unknown>,
				oldSum,
				newSum,
				txn: IDBPTransaction<unknown, string[], "versionchange">,
			) {
				const timestamp = new Date().toISOString()

				// create missing base model object stores
				for (const [name, model] of Object.entries(Config.baseModels)) {
					if (!db.objectStoreNames.contains(name)) {
						ModelDB.createModel(db, model)
					}
				}

				const baseModelDB = new ModelDB(db, Config.baseConfig, AbstractModelDB.baseVersion)
				const baseUpgradeAPI = baseModelDB.getUpgradeAPI(txn)

				const versionRecordCount = await baseUpgradeAPI.count("$versions")
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
						await AbstractModelDB.initialize(baseUpgradeAPI, timestamp, initialUpgradeVersion, initialUpgradeConfig)
					} else {
						baseModelDB.log("existing database not satisfied by initial upgrade config")
						// we ignore initialUpgradeVersion / initialUpgradeConfig and just
						// initialize directly with newVersion / newConfig
						await AbstractModelDB.initialize(baseUpgradeAPI, timestamp, newVersion, newConfig)
					}
				}

				await AbstractModelDB.upgrade(
					baseUpgradeAPI,
					timestamp,
					newVersion,
					newConfig,
					async (oldConfig, oldVersion) => {
						if (init.upgrade !== undefined) {
							const upgradeAPI = new ModelDB(db, oldConfig, oldVersion).getUpgradeAPI(txn)
							await init.upgrade(upgradeAPI, oldVersion, newVersion)
						}
					},
				)

				for (const model of newConfig.models) {
					if (!db.objectStoreNames.contains(model.name)) {
						ModelDB.createModel(db, model)
					}
				}
			},
		})

		return new ModelDB(db, newConfig, newVersion)
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

	private constructor(public readonly db: IDBPDatabase, config: Config, version: Record<string, number>) {
		super(config, version)

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

	protected hasModel(model: Model): boolean {
		return this.db.objectStoreNames.contains(model.name)
	}

	public async close() {
		this.log("closing")
		this.db.close()
	}

	private async read<T>(
		fn: (txn: IDBPTransaction<any, any, "readonly">) => T | Promise<T>,
		objectStoreNames: string[] = [...this.db.objectStoreNames],
	) {
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
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		// TODO: re-open the transaction if the caller awaits on other promises between yields
		const txn = this.db.transaction([api.storeName], "readonly", {})
		yield* api.iterate(txn, query) as AsyncIterable<T>
	}

	public async get<T extends ModelValue>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Promise<T | null> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return await this.read((txn) => api.get(txn, key) as Promise<T | null>, [api.storeName])
	}

	public async getAll<T extends ModelValue>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return await this.read((txn) => api.getAll(txn) as Promise<T[]>, [api.storeName])
	}

	public async getMany<T extends ModelValue>(
		modelName: string,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return await this.read((txn) => api.getMany(txn, keys) as Promise<(T | null)[]>, [api.storeName])
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		if (query.include) {
			return this.queryWithInclude<T>(modelName, query)
		}

		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		const result = await this.read((txn) => api.query(txn, query), [api.storeName])
		return result as T[]
	}

	private async queryWithInclude<T extends ModelValue = ModelValue>(
		modelName: string,
		query: QueryParams = {},
	): Promise<T[]> {
		assert(query.include, "internal error")
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		const modelNames = Array.from(
			new Set([modelName, ...getModelsFromInclude(this.config.models, modelName, query.include)]),
		)

		for (const modelName of modelNames) {
			if (this.#models[modelName] === undefined) {
				throw new Error(`model ${modelName} not found`)
			}
		}

		const result = await this.read(
			async (txn) => api.queryWithInclude(txn, this.#models, query),
			modelNames.map((m: string) => this.#models[m].storeName),
		)

		return result as T[]
	}

	public async count(modelName: string, where: WhereCondition = {}): Promise<number> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return await this.read((txn) => api.count(txn, where), [api.storeName])
	}

	public async clear(modelName: string): Promise<void> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return await this.write((txn) => api.clear(txn))
	}

	public async apply(effects: Effect[]): Promise<void> {
		await this.write(async (txn) => {
			await this.#apply(txn, effects)

			await Promise.all(
				[...this.subscriptions.values()].map(async ({ model, query, filter, callback }) => {
					const api = this.#models[model]
					if (api === undefined) {
						throw new Error(`model ${model} not found`)
					}

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

	async #apply(txn: IDBPTransaction<unknown, string[], "versionchange" | "readwrite">, effects: Effect[]) {
		for (const effect of effects) {
			const api = this.#models[effect.model]
			if (api === undefined) {
				throw new Error(`model ${effect.model} not found`)
			}

			if (effect.operation === "set") {
				await api.set(txn, effect.value)
			} else if (effect.operation === "delete") {
				await api.delete(txn, effect.key)
			} else {
				signalInvalidType(effect)
			}
		}
	}

	private async createModel(txn: IDBPTransaction<unknown, string[], "versionchange">, name: string, init: ModelInit) {
		const model = this.config.createModel(name, init)
		ModelDB.createModel(this.db, model)
		this.models[name] = model
		this.#models[name] = new ModelAPI(model)
		await this.#models.$models.set(txn, { name, model })
	}

	private async deleteModel(txn: IDBPTransaction<unknown, string[], "versionchange">, name: string) {
		this.config.deleteModel(name)
		this.db.deleteObjectStore(name)
		delete this.#models[name]
		delete this.models[name]
		await this.#models.$models.delete(txn, name)
	}

	private async addProperty(
		txn: IDBPTransaction<unknown, string[], "versionchange">,
		modelName: string,
		propertyName: string,
		propertyType: PropertyType,
	) {
		// const property = this.config.addProperty(modelName, propertyName, propertyType)
		throw new Error("not implemented")
	}

	private async removeProperty(
		txn: IDBPTransaction<unknown, string[], "versionchange">,
		modelName: string,
		propertyName: string,
	) {
		// this.config.removeProperty(modelName, propertyName)
		throw new Error("not implemented")
	}

	private async addIndex(txn: IDBPTransaction<unknown, string[], "versionchange">, modelName: string, index: string) {
		// const propertyNames = this.config.addIndex(modelName, index)
		throw new Error("not implemented")
	}

	private async removeIndex(
		txn: IDBPTransaction<unknown, string[], "versionchange">,
		modelName: string,
		index: string,
	) {
		// this.config.removeIndex(modelName, index)
		throw new Error("not implemented")
	}

	private getUpgradeAPI(txn: IDBPTransaction<unknown, string[], "versionchange">): DatabaseUpgradeAPI {
		return {
			get: <T>(modelName: string, key: PrimaryKeyValue | PrimaryKeyValue[]) =>
				this.#models[modelName].get(txn, key) as Promise<T>,

			getAll: <T>(modelName: string) => this.#models[modelName].getAll(txn) as Promise<T[]>,

			getMany: <T>(modelName: string, keys: PrimaryKeyValue[] | PrimaryKeyValue[][]) =>
				this.#models[modelName].getMany(txn, keys) as Promise<(T | null)[]>,

			iterate: <T>(modelName: string, query: QueryParams = {}) =>
				this.#models[modelName].iterate(txn, query) as AsyncIterable<T>,

			query: <T>(modelName: string, query: QueryParams = {}) =>
				this.#models[modelName].query(txn, query) as Promise<T[]>,

			count: (modelName: string, where: WhereCondition = {}) => this.#models[modelName].count(txn, where),
			clear: (modelName) => this.#models[modelName].clear(txn),
			apply: (effects) => this.#apply(txn, effects),
			set: (modelName, value) => this.#models[modelName].set(txn, value),
			delete: (modelName, key) => this.#models[modelName].delete(txn, key),

			createModel: (name, init) => this.createModel(txn, name, init),
			deleteModel: (name) => this.deleteModel(txn, name),
			addProperty: (modelName, propertyName, propertyInit) =>
				this.addProperty(txn, modelName, propertyName, propertyInit),
			removeProperty: (modelName, propertyName) => this.removeProperty(txn, modelName, propertyName),
			addIndex: (modelName, index) => this.addIndex(txn, modelName, index),
			removeIndex: (modelName, index) => this.removeIndex(txn, modelName, index),
		}
	}
}
