import { logger } from "@libp2p/logger"

import { assert } from "@canvas-js/utils"

import { Config, ModelValue, Effect, Model, QueryParams } from "./types.js"
import { getFilter } from "./query.js"
import { Awaitable } from "./utils.js"

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[]) => Awaitable<void>
}

export abstract class AbstractModelDB {
	public readonly models: Record<string, Model>

	protected readonly log = logger("canvas:modeldb")
	protected readonly subscriptions = new Map<number, Subscription>()
	#subscriptionId = 0

	protected constructor(public readonly config: Config) {
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	abstract close(): Promise<void>

	abstract get<T extends ModelValue<any> = ModelValue<any>>(modelName: string, key: string): Promise<T | null>

	abstract iterate(modelName: string): AsyncIterable<ModelValue>

	abstract query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]>

	abstract count(modelName: string): Promise<number>

	// Batch effect API

	public abstract apply(effects: Effect[]): Promise<void>

	// Model operations

	public async set<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		await this.apply([{ operation: "set", model: modelName, value }])
	}

	public async delete(modelName: string, key: string) {
		await this.apply([{ operation: "delete", model: modelName, key }])
	}

	public subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[]) => Awaitable<void>,
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

	private getEffectFilter(model: Model, query: QueryParams): (effect: Effect) => boolean {
		const filter = getFilter(model, query.where)

		return (effect) => {
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
