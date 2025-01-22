import { assert, signalInvalidType } from "@canvas-js/utils"
import { Awaitable } from "@canvas-js/interfaces"
import {
	AbstractModelDB,
	ModelDBBackend,
	Config,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
	ModelValueWithIncludes,
	PrimaryKeyValue,
} from "@canvas-js/modeldb"

import { SqlStorage } from "@cloudflare/workers-types"

import { ModelAPI } from "./api.js"

export interface ModelDBOptions {
	db: SqlStorage
	models: ModelSchema
}

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>
}

export class ModelDB extends AbstractModelDB {
	public readonly db: SqlStorage

	protected readonly subscriptions = new Map<number, Subscription>()
	#subscriptionId = 0

	#models: Record<string, ModelAPI> = {}

	constructor({ db, models }: ModelDBOptions) {
		super(Config.parse(models))
		this.db = db

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, this.config, model)
		}
	}

	public getType(): ModelDBBackend {
		return "sqlite-durable-objects"
	}

	public async close() {
		this.log("closing")
	}

	public async apply(effects: Effect[]) {
		// From https://developers.cloudflare.com/durable-objects/api/storage-api/#transaction
		// > Explicit transactions are no longer necessary. Any series of write
		// > operations with no intervening await will automatically be submitted
		// > atomically, and the system will prevent concurrent events from executing
		// > while await a read operation (unless you use allowConcurrency: true).
		// > Therefore, a series of reads followed by a series of writes (with no other
		// > intervening I/O) are automatically atomic and behave like a transaction

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

	public subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>,
	): { id: number; results: Promise<ModelValue[]> } {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)

		const filter = this.getEffectFilter(model, query)
		const id = this.#subscriptionId++
		this.subscriptions.set(id, { model: modelName, query, filter, callback })

		return {
			id,
			results: this.query(modelName, query).then((results) =>
				Promise.resolve(callback(results)).then(
					() => results,
					(err) => {
						this.log.error(err)
						return results
					},
				),
			),
		}
	}

	public unsubscribe(id: number) {
		this.subscriptions.delete(id)
	}
}
