import Database, * as sqlite from "better-sqlite3"

import { AbstractModelDB } from "../AbstractModelDB.js"
import { parseConfig } from "../config.js"
import { ModelAPI } from "./api.js"
import { Effect, ModelValue, ModelsInit, QueryParams } from "../types.js"
import { assert, signalInvalidType } from "../utils.js"

export interface ModelDBOptions {
	path: string | null
	models: ModelsInit
	indexHistory?: Record<string, boolean>
}

export class ModelDB extends AbstractModelDB {
	public readonly db: sqlite.Database

	#models: Record<string, ModelAPI> = {}
	#transaction: sqlite.Transaction<(effects: Effect[]) => void>

	constructor({ path, models, indexHistory }: ModelDBOptions) {
		super(parseConfig(models), { indexHistory })

		this.db = new Database(path ?? ":memory:")

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, model)
		}

		this.#transaction = this.db.transaction((effects) => {
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

	public async close() {
		this.log("closing")
		this.db.close()
	}

	public async apply(effects: Effect[]) {
		this.#transaction(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				assert(api !== undefined, `model API not found`)
				try {
					callback(api.query(query))
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

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		yield* api.values()
	}

	public async count(modelName: string): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count()
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.query(query) as T[]
	}
}
