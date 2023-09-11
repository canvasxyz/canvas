import { IDBPDatabase, IDBPTransaction, openDB } from "idb"

import { AbstractModelDB, ModelDBOptions } from "../AbstractModelDB.js"

import { Config, Context, Effect, ModelValue, ModelsInit, QueryParams } from "../types.js"
import { parseConfig } from "../config.js"
import { Awaitable, assert, signalInvalidType } from "../utils.js"

import { ModelAPI } from "./api.js"
import { getIndexName, getObjectStoreName, getTombstoneObjectStoreName } from "./utils.js"

export class ModelDB extends AbstractModelDB {
	public static async initialize(name: string, models: ModelsInit, options: ModelDBOptions = {}) {
		const config = parseConfig(models)
		const db = await openDB(name, 1, {
			upgrade(db: IDBPDatabase<unknown>) {
				// create object stores
				for (const model of config.models) {
					const recordObjectStore = db.createObjectStore(getObjectStoreName(model.name))
					db.createObjectStore(getTombstoneObjectStoreName(model.name))

					for (const index of model.indexes) {
						if (index.length > 1) {
							// TODO: we can support these by adding synthetic values to every object
							throw new Error("multi-property indexes not supported yet")
						}

						const [property] = index
						recordObjectStore.createIndex(getIndexName(index), property)
					}
				}
			},
		})

		return new ModelDB(db, config, options)
	}

	readonly #models: Record<string, ModelAPI> = {}

	private constructor(public readonly db: IDBPDatabase, config: Config, options: ModelDBOptions) {
		super(config, options)

		for (const model of config.models) {
			this.#models[model.name] = new ModelAPI(model, this.resolver)
		}
	}

	private async read<T>(
		fn: (txn: IDBPTransaction<any, any, "readonly">) => Awaitable<T>,
		objectStoreNames: string[] = [...this.db.objectStoreNames]
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

	public async *iterate(modelName: string): AsyncIterable<[key: string, value: ModelValue]> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model not found")

		// TODO: re-open the transaction if the caller awaits on other promises between yields
		const txn = this.db.transaction([api.storeName], "readonly", {})
		yield* api.iterate(txn)
	}

	public async get(modelName: string, key: string): Promise<ModelValue | null> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model API not found")
		return await this.read((txn) => api.get(txn, key), [api.storeName])
	}

	public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model API not found")
		return await this.read((txn) => api.query(txn, query), [api.storeName])
	}

	public async count(modelName: string): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, "model API not found")
		return await this.db.count(api.storeName)
	}

	public async apply(effects: Effect[], context: Context = { version: null }): Promise<void> {
		await this.write(async (txn) => {
			for (const effect of effects) {
				const api = this.#models[effect.model]
				assert(api !== undefined, "model API not found")
				if (effect.operation === "set") {
					await api.set(txn, context, effect.key, effect.value)
				} else if (effect.operation === "delete") {
					await api.delete(txn, context, effect.key)
				} else {
					signalInvalidType(effect)
				}
			}

			await Promise.all(
				[...this.subscriptions.values()].map(async ({ model, query, filter, callback }) => {
					const api = this.#models[model]
					assert(api !== undefined, "model API not found")
					if (effects.some((effect) => filter(effect))) {
						try {
							const results = await api.query(txn, query)
							await callback(results, context)
						} catch (err) {
							this.log.error(err)
						}
					}
				})
			)
		})
	}

	async close() {
		this.db.close()
	}
}
