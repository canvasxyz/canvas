import { Logger } from "@libp2p/logger"
import { Config, Effect, ModelValue, QueryParams } from "@canvas-js/modeldb"
import { assert, signalInvalidType } from "@canvas-js/utils"
import { Database } from "@sqlite.org/sqlite-wasm"
import { ModelAPI } from "./ModelAPI.js"

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[]) => Promise<void> | void
}

export class InnerModelDB {
	public readonly db: Database
	#models: Record<string, ModelAPI> = {}
	protected readonly subscriptions = new Map<number, Subscription>()
	protected readonly log: Logger

	public constructor(db: Database, config: Config, log: Logger) {
		this.db = db

		for (const model of Object.values(config.models)) {
			this.#models[model.name] = new ModelAPI(this.db, model)
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

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				assert(api !== undefined, `model ${model} not found`)
				try {
					callback(api.query(query))
				} catch (err) {
					console.error(err)
				}
			}
		}
	}

	public get<T extends ModelValue>(modelName: string, key: string): T {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as T
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

	public subscribe(
		id: number,
		modelName: string,
		query: QueryParams,
		filter: (effect: Effect) => boolean,
		callback: (results: ModelValue[]) => void,
	) {
		this.subscriptions.set(id, { model: modelName, query, filter, callback })
	}
}