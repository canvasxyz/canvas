import { Logger, logger } from "@libp2p/logger"

import { assert } from "@canvas-js/utils"

import { Config } from "./config.js"
import {
	ModelValue,
	Effect,
	Model,
	QueryParams,
	WhereCondition,
	ModelValueWithIncludes,
	PrimaryKeyValue,
} from "./types.js"
import { getFilter } from "./query.js"
import { Awaitable, getModelsFromInclude, mergeModelValues, updateModelValues } from "./utils.js"

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>
}

export type ModelDBBackend =
	| "idb"
	| "postgres"
	| "sqlite-disk"
	| "sqlite-memory"
	| "sqlite-wasm"
	| "sqlite-expo"
	| "sqlite-durable-objects"

export abstract class AbstractModelDB {
	public readonly models: Record<string, Model>

	protected readonly log: Logger
	protected readonly subscriptions = new Map<number, Subscription>()
	#subscriptionId = 0

	protected constructor(public readonly config: Config) {
		this.log = logger(`canvas:modeldb`)
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	abstract getType(): ModelDBBackend

	abstract close(): Promise<void>

	abstract get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Awaitable<T | null>

	abstract getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Awaitable<T[]>

	abstract getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Awaitable<(T | null)[]>

	abstract iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query?: QueryParams,
	): AsyncIterable<T>

	abstract query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]>

	abstract count(modelName: string, where?: WhereCondition): Promise<number>

	abstract clear(modelName: string): Promise<void>

	// Batch effect API

	public abstract apply(effects: Effect[]): Awaitable<void>

	// Model operations

	public async set<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		await this.apply([{ operation: "set", model: modelName, value }])
	}

	public async delete(modelName: string, key: PrimaryKeyValue | PrimaryKeyValue[]) {
		await this.apply([{ operation: "delete", model: modelName, key }])
	}

	public async update<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		const key = this.models[modelName].primaryKey.map((key) => value[key])
		const existingValue = await this.get<T>(modelName, key)
		const updatedValue = updateModelValues(value, existingValue)
		await this.apply([{ operation: "set", model: modelName, value: updatedValue }])
	}

	public async merge<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		const key = this.models[modelName].primaryKey.map((key) => value[key])
		const existingValue = await this.get<T>(modelName, key)
		const mergedValue = mergeModelValues(value, existingValue)
		await this.apply([{ operation: "set", model: modelName, value: mergedValue }])
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

	protected getEffectFilter(model: Model, query: QueryParams): (effect: Effect) => boolean {
		const filter = getFilter(model, query.where)

		const includeModels = query.include
			? Array.from(getModelsFromInclude(this.config.models, model.name, query.include))
			: []

		return (effect) => {
			// TODO: we should memoize the set of joined models returned the last time
			// subscribe() triggered a callback, and check for inclusion in that set
			if (query.include && includeModels.includes(effect.model)) {
				return true
			}

			if (effect.model !== model.name) {
				return false
			}

			if (effect.operation === "set") {
				if (!filter(effect.value)) {
					return false
				}
			}

			// TODO: we could do more to filter out more effects:
			// - look up the previous value before deleting and see if it was a possible query result
			// - for queries with defined a order and limit, track the order property value of the
			//   last query result, and if the a new value is set with a later order property value,
			//   filter the effect out.

			return true
		}
	}
}
