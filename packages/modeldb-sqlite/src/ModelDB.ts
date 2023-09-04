import Database, * as sqlite from "better-sqlite3"

import {
	AbstractModelDB,
	Context,
	Effect,
	ModelDBOptions,
	ModelValue,
	ModelsInit,
	parseConfig,
} from "@canvas-js/modeldb-interface"

import { ModelAPI } from "./api.js"
import { assert, signalInvalidType } from "./utils.js"

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

	public async apply(context: Context, effects: Effect[]) {
		this.#transaction(context, effects)
	}

	public async get(modelName: string, key: string) {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key)
	}

	public async *iterate(
		modelName: string
	): AsyncIterable<[key: string, value: ModelValue, version: Uint8Array | null]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		yield* api.entries()
	}

	// public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {}

	public async count(modelName: string): Promise<number> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count()
	}
}
