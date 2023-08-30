import { IDBPDatabase, IDBPTransaction, openDB } from "idb"

import {
	AbstractModelDB,
	Config,
	Effect,
	ModelValue,
	ModelsInit,
	QueryParams,
	Resolver,
	parseConfig,
} from "@canvas-js/modeldb-interface"

import {
	createImmutableModelAPI,
	createMutableModelAPI,
	getPropertyIndexName,
	getRecordStoreName,
	getRelationStoreName,
	getTombstoneStoreName,
} from "./api.js"
import { assert, signalInvalidType } from "./utils.js"

export interface ModelDBOptions {
	databaseName?: string
	resolver?: Resolver
}

export class ModelDB extends AbstractModelDB {
	public options?: ModelDBOptions
	public resolver?: Resolver

	public static async initialize(models: ModelsInit, options?: ModelDBOptions) {
		const config = parseConfig(models)

		for (const model of config.models) {
			const columnNames: string[] = []
			for (const [i, property] of model.properties.entries()) {
				if (property.kind === "primitive" || property.kind === "reference") {
					columnNames.push(`"${property.name}"`)
				} else if (property.kind === "relation") {
					continue
				} else {
					signalInvalidType(property)
				}
			}
			if (columnNames.length == 0) {
				throw new Error(`Model "${model.name}" has no columns`)
			}
		}

		const db = await openDB(options?.databaseName || "modeldb", 1, {
			upgrade(db: IDBPDatabase<unknown>) {
				// create model stores
				for (const model of config.models) {
					const recordObjectStore = db.createObjectStore(getRecordStoreName(model.name))
					if (model.kind == "mutable") {
						db.createObjectStore(getTombstoneStoreName(model.name))
					}

					for (const index of model.indexes) {
						const sortedIndex = index.sort()
						recordObjectStore.createIndex(getPropertyIndexName(model.name, sortedIndex), sortedIndex)
					}
				}

				for (const relation of config.relations) {
					const relationObjectStore = db.createObjectStore(getRelationStoreName(relation.source, relation.property))
					relationObjectStore.createIndex("source", "_source")
				}
			},
		})

		return new ModelDB(db, config, options)
	}

	constructor(public readonly db: IDBPDatabase, config: Config, options?: ModelDBOptions) {
		super(config)
		this.options = options
		this.resolver = options?.resolver
	}

	public async withAsyncTransaction<T>(
		fn: (transaction: IDBPTransaction<any, any, "readwrite">) => Promise<T>
	): Promise<T> {
		let transaction: IDBPTransaction<any, any, "readwrite">

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
			transaction!.abort()
			throw e
		}
	}

	public withTransaction<T>(fn: (transaction: IDBPTransaction<any, any, "readwrite">) => T): T {
		const transaction = this.db.transaction(this.db.objectStoreNames, "readwrite")
		try {
			return fn(transaction)
		} catch (e) {
			// rollback transaction if it fails
			transaction.abort()
			throw e
		}
	}

	public async get(modelName: string, key: string) {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		if (model.kind == "mutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createMutableModelAPI(transaction, model, this.resolver)
				return await MutableModelAPI.get(key, dbContext)
			})
		} else if (model.kind == "immutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createImmutableModelAPI(transaction, model)
				return await ImmutableModelAPI.get(key, dbContext)
			})
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async selectAll(modelName: string): Promise<ModelValue[]> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		if (model.kind == "mutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createMutableModelAPI(transaction, model, this.resolver)
				return await MutableModelAPI.selectAll(dbContext)
			})
		} else if (model.kind == "immutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createImmutableModelAPI(transaction, model)
				return await ImmutableModelAPI.selectAll(dbContext)
			})
		} else {
			signalInvalidType(model.kind)
		}
	}

	public iterate(modelName: string): AsyncIterable<ModelValue> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		if (model.kind == "mutable") {
			return this.withTransaction((transaction) => {
				const dbContext = createMutableModelAPI(transaction, model, this.resolver)
				return MutableModelAPI.iterate(dbContext)
			})
		} else if (model.kind == "immutable") {
			return this.withTransaction((transaction) => {
				const dbContext = createImmutableModelAPI(transaction, model)
				return ImmutableModelAPI.iterate(dbContext)
			})
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		if (model.kind == "mutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createMutableModelAPI(transaction, model, this.resolver)
				return MutableModelAPI.query(query, dbContext)
			})
		} else if (model.kind == "immutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createImmutableModelAPI(transaction, model)
				return await ImmutableModelAPI.query(query, dbContext)
			})
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async count(modelName: string): Promise<number> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		if (model.kind == "mutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createMutableModelAPI(transaction, model, this.resolver)
				return MutableModelAPI.count(dbContext)
			})
		} else if (model.kind == "immutable") {
			return this.withAsyncTransaction(async (transaction) => {
				const dbContext = createImmutableModelAPI(transaction, model)
				return await ImmutableModelAPI.count(dbContext)
			})
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async apply(
		effects: Effect[],
		options: { namespace?: string | undefined; version?: string | undefined }
	): Promise<void> {
		const { version, namespace } = options

		await this.withAsyncTransaction(async (transaction) => {
			const immutableDbContexts: Record<string, ImmutableModelDBContext> = {}
			const mutableDbContexts: Record<string, MutableModelDBContext> = {}

			for (const model of Object.values(this.models)) {
				if (model.kind == "immutable") {
					immutableDbContexts[model.name] = createImmutableModelAPI(transaction, model)
				} else if (model.kind == "mutable") {
					mutableDbContexts[model.name] = createMutableModelAPI(transaction, model, this.resolver)
				} else {
					signalInvalidType(model.kind)
				}
			}

			for (const effect of effects) {
				const model = this.models[effect.model]
				assert(model !== undefined, `model ${effect.model} not found`)

				if (effect.operation === "add") {
					assert(model.kind == "immutable", "cannot call .add on a mutable model")
					await ImmutableModelAPI.add(effect.value, { namespace }, immutableDbContexts[model.name])
				} else if (effect.operation === "remove") {
					assert(model.kind == "immutable", "cannot call .remove on a mutable model")
					await ImmutableModelAPI.remove(effect.key, immutableDbContexts[model.name])
				} else if (effect.operation === "set") {
					assert(model.kind == "mutable", "cannot call .set on an immutable model")
					await MutableModelAPI.set(effect.key, effect.value, { version }, mutableDbContexts[model.name])
				} else if (effect.operation === "delete") {
					assert(model.kind == "mutable", "cannot call .delete on an immutable model")
					await MutableModelAPI.delete(effect.key, { version }, mutableDbContexts[model.name])
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
