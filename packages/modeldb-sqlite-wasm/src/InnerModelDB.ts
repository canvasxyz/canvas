import * as Comlink from "comlink"
import { Logger } from "@libp2p/logger"
import { Config, Effect, ModelValue, QueryParams, WhereCondition } from "@canvas-js/modeldb"
import { assert, signalInvalidType } from "@canvas-js/utils"
import { Database } from "@sqlite.org/sqlite-wasm"
import { ModelAPI } from "./ModelAPI.js"

export class InnerModelDB {
	public readonly db: Database
	#models: Record<string, ModelAPI> = {}
	protected readonly log: Logger

	public constructor(db: Database, config: Config, log: Logger) {
		this.db = db

		for (const model of Object.values(config.models)) {
			this.#models[model.name] = new ModelAPI(this.db, config, model)
		}
		this.log = log
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
		})
	}

	public get<T extends ModelValue>(modelName: string, key: string): T {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as T
	}

	public async getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getAll() as T[]
	}

	public getMany<T extends ModelValue>(modelName: string, keys: string[]): T[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getMany(keys) as T[]
	}

	public iterate(modelName: string, query: QueryParams = {}): AsyncIterable<ModelValue> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return Comlink.proxy({
			[Symbol.asyncIterator]() {
				const iter = api.iterate(query)

				return {
					async next() {
						return iter.next()
					},

					async return(value) {
						return iter.return?.(value) ?? { done: true, value: undefined }
					},

					async throw(err) {
						return iter.throw?.(err) ?? { done: true, value: undefined }
					},
				}
			},
		})
	}

	public count(modelName: string, where?: WhereCondition): number {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count(where)
	}

	public query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): T[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.query(query) as T[]
	}

	public clear(modelName: string): void {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.clear()
	}
}
