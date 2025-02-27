/// <reference lib="webworker" />

import sqlite3InitModule, { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm"
import { logger } from "@libp2p/logger"
import {
	AbstractModelDB,
	Config,
	Effect,
	ModelDBBackend,
	ModelSchema,
	ModelValue,
	QueryParams,
	WhereCondition,
} from "@canvas-js/modeldb"
import { assert, signalInvalidType } from "@canvas-js/utils"

import { ModelAPI } from "./ModelAPI.js"

export interface ModelDBOptions {
	sqlite3?: Sqlite3Static
	path?: string | null
	models: ModelSchema
}

const isWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	protected readonly log = logger("canvas:modeldb")

	public static async open({ sqlite3, path, models }: ModelDBOptions) {
		if (sqlite3 === undefined) {
			sqlite3 = await sqlite3InitModule({
				print: console.log,
				printErr: console.error,
			})
		}

		return new ModelDB(sqlite3, path ?? null, models)
	}

	public readonly db: Database

	public constructor(public readonly sqlite3: Sqlite3Static, public readonly path: string | null, models: ModelSchema) {
		super(Config.parse(models), {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		this.log("Running SQLite3 version %s", sqlite3.version.libVersion)

		if (path === null) {
			this.db = new sqlite3.oo1.DB(":memory:")
		} else if (isWorker) {
			if ("opfs" in sqlite3) {
				this.db = new sqlite3.oo1.OpfsDb(path, "c")
			} else {
				throw new Error("cannot open persistent database: missing OPFS API support")
			}
		} else {
			throw new Error("cannot open persistent database: persistent databases are only available in worker threads")
		}

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
}
