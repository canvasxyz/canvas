import { IDBPDatabase, IDBPTransaction, openDB } from "idb"

import { assert, signalInvalidType } from "@canvas-js/utils"

import { AbstractModelDB, Config, Effect, ModelValue, ModelSchema, QueryParams, parseConfig } from "@canvas-js/modeldb"

import { ModelAPI } from "./api.js"
import { getIndexName, checkForMissingObjectStores } from "./utils.js"

export interface ModelDBOptions {
	name: string
	models: ModelSchema
}

export class ModelDB extends AbstractModelDB {
	public static async initialize({ name, models }: ModelDBOptions) {
		const config = parseConfig(models)
		const db = await openDB(name, 1, {
			upgrade(db: IDBPDatabase<unknown>) {
				// create object stores
				for (const model of config.models) {
					const primaryKey = model.properties.find((property) => property.kind === "primary")
					assert(primaryKey !== undefined, "expected primaryKey !== undefined")

					const recordObjectStore = db.createObjectStore(model.name, { keyPath: primaryKey.name })

					for (const index of model.indexes) {
						if (index.length > 1) {
							// TODO: we can support these by adding synthetic array values to every object
							throw new Error("multi-property indexes not supported yet")
						}

						const [property] = index
						recordObjectStore.createIndex(getIndexName(index), property)
					}
				}
			},
		})

		return new ModelDB(db, config)
	}

	readonly #models: Record<string, ModelAPI> = {}

	private constructor(
		public readonly db: IDBPDatabase,
		config: Config,
	) {
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

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)

		// TODO: re-open the transaction if the caller awaits on other promises between yields
		checkForMissingObjectStores(this.db, [api.storeName])
		const txn = this.db.transaction([api.storeName], "readonly", {})
		yield* api.iterate(txn)
	}

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return await this.read((txn) => api.get(txn, key) as Promise<T | null>, [api.storeName])
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		const result = await this.read((txn) => api.query(txn, query), [api.storeName])
		return result as T[]
	}

	public async count(modelName: string): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		checkForMissingObjectStores(this.db, [api.storeName])
		return await this.db.count(api.storeName)
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
}
