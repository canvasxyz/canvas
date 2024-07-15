import { Config, Effect, ModelValue, QueryParams } from "@canvas-js/modeldb"
import { assert, signalInvalidType } from "@canvas-js/utils"
import sqlite3InitModule, { OpfsDatabase } from "@sqlite.org/sqlite-wasm"
import { ModelAPI } from "./ModelAPI.js"

const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error })

export class InnerModelDB {
	public readonly db: OpfsDatabase
	#models: Record<string, ModelAPI> = {}

	public constructor(dbName: string, config: Config) {
		this.db = new sqlite3.oo1.OpfsDb(`./${dbName}.sqlite3`)

		for (const model of Object.values(config.models)) {
			this.#models[model.name] = new ModelAPI(this.db, model)
		}
	}

	public async apply(effects: Effect[]) {
		this.db.transaction((db) => {
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
		})

		// how do we handle subscriptions?
		// some of this should probably be outside of the worker
		//
		// for (const { model, query, filter, callback } of this.subscriptions.values()) {
		// 	if (effects.some(filter)) {
		// 		const api = this.#models[model]
		// 		assert(api !== undefined, `model ${model} not found`)
		// 		try {
		// 			callback(api.query(query))
		// 		} catch (err) {
		// 			this.log.error(err)
		// 		}
		// 	}
		// }
	}

	public get<T extends ModelValue>(modelName: string, key: string): T | null {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as T | null
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		yield* api.values()
	}

	public count(modelName: string): number {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count()
	}

	public query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): T[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.query(query) as T[]
	}
}
