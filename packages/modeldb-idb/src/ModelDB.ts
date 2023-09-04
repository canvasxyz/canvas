import { IDBPDatabase, IDBPTransaction, openDB } from "idb"

import {
	AbstractModelDB,
	Config,
	Context,
	Effect,
	Model,
	ModelDBOptions,
	ModelValue,
	ModelsInit,
	QueryParams,
	Resolver,
	parseConfig,
	validateModelValue,
} from "@canvas-js/modeldb-interface"

import { assert, signalInvalidType } from "./utils.js"

type Transaction = IDBPTransaction<any, any, "readwrite">

const objectStoreNames = {
	record: (model: string) => `record/${model}`,
	tombstone: (model: string) => `tombstone/${model}`,
	index: (model: string, index: string[]) => `record/${model}/${index.join("/")}`,
}

export class ModelDB extends AbstractModelDB {
	public static async initialize(name: string, models: ModelsInit, options: ModelDBOptions = {}) {
		const config = parseConfig(models)
		const db = await openDB(name, 1, {
			upgrade(db: IDBPDatabase<unknown>) {
				// create object stores
				for (const model of config.models) {
					const recordObjectStore = db.createObjectStore(objectStoreNames.record(model.name))
					db.createObjectStore(objectStoreNames.tombstone(model.name))

					for (const index of model.indexes) {
						if (index.length > 1) {
							// TODO: we can support these by adding synthetic values to every object
							throw new Error("multi-property indexes not supported yet")
						}

						recordObjectStore.createIndex(objectStoreNames.index(model.name, index), index)
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

	private async withAsyncTransaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> {
		let transaction: Transaction | null = null

		try {
			transaction = this.db.transaction(this.db.objectStoreNames, "readwrite")
			// we have to use Promise.all here, not sure why this works
			// otherwise we get an unthrowable AbortError
			// it might be because if a transaction fails, idb doesn't know if there are any
			// more database operations that would have been performed in the transaction
			// this is just a post hoc rationalisation though
			// https://github.com/jakearchibald/idb/issues/256#issuecomment-1048551626
			const [res, _] = await Promise.all([fn(transaction), transaction.done])
			return res
		} catch (e) {
			transaction?.abort()
			throw e
		}
	}

	public async *iterate(
		modelName: string
	): AsyncIterable<[key: string, value: ModelValue, version: Uint8Array | null]> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		const api = this.#models[modelName]
		// TODO
	}

	public async get(modelName: string, key: string): Promise<ModelValue | null> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")
		const value: ObjectValue | undefined = await this.db.get(objectStoreNames.record(modelName), key)
		if (value === undefined) {
			return null
		} else {
			const { _version, ...rest } = value
			return rest
		}
	}

	// public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {
	// 	const model = this.models[modelName]
	// 	assert(model !== undefined, "model not found")

	// 	if (model.kind == "mutable") {
	// 		return this.withAsyncTransaction(async (transaction) => {
	// 			const dbContext = createMutableModelAPI(transaction, model, this.resolver)
	// 			return MutableModelAPI.query(query, dbContext)
	// 		})
	// 	} else if (model.kind == "immutable") {
	// 		return this.withAsyncTransaction(async (transaction) => {
	// 			const dbContext = createImmutableModelAPI(transaction, model)
	// 			return await ImmutableModelAPI.query(query, dbContext)
	// 		})
	// 	} else {
	// 		signalInvalidType(model.kind)
	// 	}
	// }

	public async count(modelName: string): Promise<number> {
		assert(this.models[modelName] !== undefined, "model not found")
		return await this.db.count(objectStoreNames.record(modelName))
	}

	public async apply(context: Context, effects: Effect[]): Promise<void> {
		await this.withAsyncTransaction(async (txn) => {
			for (const effect of effects) {
				const api = this.#models[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				if (effect.operation === "set") {
					await api.set(txn, context, effect.key, effect.value)
				} else if (effect.operation === "delete") {
					await api.delete(txn, context, effect.key)
				} else {
					signalInvalidType(effect)
				}
			}
		})
	}

	async close() {
		this.db.close()
	}
}

type ObjectValue = ModelValue & { _version: Uint8Array | null }
type Tombstone = { _version: Uint8Array }

class ModelAPI {
	constructor(readonly model: Model, readonly resolver: Resolver) {}

	private getStore(txn: Transaction) {
		return txn.objectStore(objectStoreNames.record(this.model.name))
	}

	private getTombstoneStore(txn: Transaction) {
		return txn.objectStore(objectStoreNames.tombstone(this.model.name))
	}

	async set(txn: Transaction, context: { version: Uint8Array | null }, key: string, value: ModelValue): Promise<void> {
		validateModelValue(this.model, value)

		const [store, tombstoneStore] = [this.getStore(txn), this.getTombstoneStore(txn)]

		// no-op if an existing value takes precedence
		const existingValue: ObjectValue | undefined = await store.get(key)
		if (existingValue !== undefined && this.resolver.lessThan(context, { version: existingValue._version })) {
			return
		}

		// no-op if an existing tombstone takes precedence
		const existingTombstone: Tombstone | undefined = await tombstoneStore.get(key)
		if (existingTombstone !== undefined && this.resolver.lessThan(context, { version: existingTombstone._version })) {
			return
		}

		// delete the tombstone since we're about to set the value
		if (existingTombstone !== undefined) {
			await tombstoneStore.delete(key)
		}

		await store.put({ ...value, _version: context.version }, key)
	}

	async delete(txn: Transaction, context: Context, key: string): Promise<void> {
		const [store, tombstoneStore] = [this.getStore(txn), this.getTombstoneStore(txn)]

		// no-op if an existing value takes precedence
		const existingValue: ObjectValue | undefined = await store.get(key)
		if (existingValue !== undefined && this.resolver.lessThan(context, { version: existingValue._version })) {
			return
		}

		// no-op if an existing tombstone takes precedence
		const existingTombstone: Tombstone | undefined = await tombstoneStore.get(key)
		if (existingTombstone !== undefined && this.resolver.lessThan(context, { version: existingTombstone._version })) {
			return
		}

		if (context.version !== null) {
			await tombstoneStore.put({ _version: context.version }, key)
		}

		await store.delete(key)
	}
}
