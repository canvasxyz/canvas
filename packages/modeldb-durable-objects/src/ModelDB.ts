import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	AbstractModelDB,
	parseConfig,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
} from "@canvas-js/modeldb"

import { SqlStorage } from "@cloudflare/workers-types"

import { ModelAPI } from "./api.js"

export interface ModelDBOptions {
	db: SqlStorage
	models: ModelSchema
}

export class ModelDB extends AbstractModelDB {
	public readonly db: SqlStorage

	#models: Record<string, ModelAPI> = {}

	constructor({ db, models }: ModelDBOptions) {
		super(parseConfig(models))
		this.db = db

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, model)
		}
	}

	public async close() {
		this.log("closing")
	}

	public async apply(effects: Effect[]) {
		// no #transaction, durable object operations are implicitly transactionalized
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

	public async set<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T): Promise<void> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.set(value)
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
