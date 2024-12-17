import { SQLiteDatabase } from "expo-sqlite"
import * as SQLite from "expo-sqlite"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	AbstractModelDB,
	ModelDBBackend,
	parseConfig,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
} from "@canvas-js/modeldb"

import { ModelAPI } from "./api.js"

export interface ModelDBOptions {
	path: string | null
	models: ModelSchema
}

export class ModelDB extends AbstractModelDB {
	public readonly db: SQLiteDatabase

	#models: Record<string, ModelAPI> = {}
	#transaction: (effects: Effect[]) => void

	constructor({ path, models, clear }: { clear?: boolean } & ModelDBOptions) {
		super(parseConfig(models))

		this.db = SQLite.openDatabaseSync(path ?? ":memory:")

		if (clear) {
			this.db.withTransactionSync(() => {
				const tables = this.db.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
				for (const table of tables) {
					// execSync works inconsistently in expo, use runSync instead
					if (table.name.includes("\\") || table.name.includes('"')) {
						throw new Error("unexpected table name, try clearing your database using Expo/Drizzle")
					}
					this.db.runSync(`DROP TABLE IF EXISTS "${table.name}"`)
				}
			})
		}

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, model)
		}

		this.#transaction = (effects: Effect[]) =>
			this.db.withTransactionSync(() => {
				for (const effect of effects) {
					const model = this.models[effect.model]
					assert(model !== undefined, `model ${effect.model} not found`)
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

	public getType(): ModelDBBackend {
		return "sqlite-expo"
	}

	public async close() {
		this.log("closing")
		this.db.closeSync()
	}

	public async apply(effects: Effect[]) {
		this.#transaction(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				assert(api !== undefined, `model ${model} not found`)
				try {
					callback(api.query(query))
				} catch (err) {
					this.log.error(err)
				}
			}
		}
	}

	public async get<T extends ModelValue<any> = ModelValue<any>>(modelName: string, key: string): Promise<T | null> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as T | null
	}

	public async getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		keys: string[],
	): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getMany(keys) as (T | null)[]
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		yield* api.iterate(query) as Iterable<T>
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

	public async query<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.query(query) as T[]
	}
}
