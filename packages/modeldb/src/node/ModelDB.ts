import Database, * as sqlite from "better-sqlite3"

import { AbstractModelDB, ModelDBOptions } from "../AbstractModelDB.js"
import { parseConfig } from "../config.js"
import { Context, Effect, ModelValue, ModelsInit, QueryParams } from "../types.js"
import { assert, signalInvalidType } from "../utils.js"

import { ModelAPI } from "./api.js"

export class ModelDB extends AbstractModelDB {
	public readonly db: sqlite.Database

	#models: Record<string, ModelAPI> = {}
	#transaction: sqlite.Transaction<(context: Context, effects: Effect[]) => void>

	constructor(public readonly path: string | null, models: ModelsInit, options: ModelDBOptions = {}) {
		super(parseConfig(models), options)

		this.db = new Database(path ?? ":memory:")

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, model, this.resolver)
		}

		this.#transaction = this.db.transaction((context, effects) => {
			for (const effect of effects) {
				const model = this.models[effect.model]
				assert(model !== undefined, `model ${effect.model} not found`)
				if (effect.operation === "set") {
					this.#models[effect.model].set(context, effect.key, effect.value)
				} else if (effect.operation === "delete") {
					this.#models[effect.model].delete(context, effect.key)
				} else {
					signalInvalidType(effect)
				}
			}
		})
	}

	public async close() {
		this.db.close()
	}

	public async apply(effects: Effect[], context: Context = { version: null }) {
		this.#transaction(context, effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				assert(api !== undefined, `model API not found`)
				try {
					callback(api.query(query), context)
				} catch (err) {
					this.log.error(err)
				}
			}
		}
	}

	public async get(modelName: string, key: string) {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key)
	}

	public async *iterate(modelName: string): AsyncIterable<[key: string, value: ModelValue]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		yield* api.entries()
	}

	public async count(modelName: string): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count()
	}

	public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.query(query)
	}
}
