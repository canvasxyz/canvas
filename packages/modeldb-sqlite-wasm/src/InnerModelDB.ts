import * as Comlink from "comlink"
import { Logger } from "@libp2p/logger"
import { Config, Effect, ModelValue, QueryParams, WhereCondition } from "@canvas-js/modeldb"
import { ModelAPI } from "@canvas-js/modeldb-sqlite-shared"
import { assert, signalInvalidType } from "@canvas-js/utils"
import { Database } from "@sqlite.org/sqlite-wasm"

import { SqliteDB } from "./SqliteDB.js"

export class InnerModelDB {
	public readonly db: Database
	#models: Record<string, ModelAPI> = {}
	protected readonly log: Logger

	public constructor(db: Database, config: Config, log: Logger) {
		this.db = db
		const wrappedDb = new SqliteDB(this.db)

		for (const model of Object.values(config.models)) {
			this.#models[model.name] = new ModelAPI(wrappedDb, model)
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

	public getMany<T extends ModelValue>(modelName: string, keys: string[]): T[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getMany(keys) as T[]
	}

	public iterate<T extends ModelValue>(modelName: string, query: QueryParams = {}): AsyncIterable<T> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return Comlink.proxy(api.iterate(query)) as AsyncIterable<T>
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
