import { logger } from "@libp2p/logger"

import { Config, ModelValue, Effect, Model, QueryParams, Resolver, Context } from "./types.js"
import { Awaitable, assert, defaultResolver, getImmutableRecordKey } from "./utils.js"
import { getFilter } from "./query.js"

export interface ModelDBOptions {
	resolver?: Resolver
}

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[], context: Context | null) => Awaitable<void>
}

export abstract class AbstractModelDB {
	public static getImmutableRecordKey = getImmutableRecordKey

	public readonly models: Record<string, Model>
	public readonly resolver: Resolver

	protected readonly log = logger("canvas:modeldb")
	protected readonly subscriptions = new Map<number, Subscription>()
	#id = 0

	public constructor(public readonly config: Config, { resolver }: ModelDBOptions) {
		this.resolver = resolver ?? defaultResolver
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	abstract close(): Promise<void>

	abstract get(modelName: string, key: string): Promise<ModelValue | null>

	abstract iterate(modelName: string): AsyncIterable<[key: string, value: ModelValue]>

	abstract query(modelName: string, query: QueryParams): Promise<ModelValue[]>

	abstract count(modelName: string): Promise<number>

	// Batch effect API

	public abstract apply(effects: Effect[], context?: Context): Promise<void>

	// Model operations

	public async add(
		modelName: string,
		value: ModelValue,
		context: { version?: Uint8Array | null } = {}
	): Promise<string> {
		const { version = null } = context
		const key = getImmutableRecordKey(value)
		await this.apply([{ operation: "set", model: modelName, key, value }], { version })
		return key
	}

	public async set(modelName: string, key: string, value: ModelValue, context: { version?: Uint8Array | null } = {}) {
		const { version = null } = context
		await this.apply([{ operation: "set", model: modelName, key, value }], { version })
	}

	public async delete(modelName: string, key: string, context: { version?: Uint8Array | null } = {}) {
		const { version = null } = context
		await this.apply([{ operation: "delete", model: modelName, key }], { version })
	}

	public subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[], context: Context | null) => Awaitable<void>
	): { id: number; results: Promise<ModelValue[]> } {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		const filter = this.getEffectFilter(model, query)
		const id = this.#id++
		this.subscriptions.set(id, { model: modelName, query, filter, callback })

		return {
			id,
			results: this.query(modelName, query).then((results) =>
				Promise.resolve(callback(results, null)).then(
					() => results,
					(err) => {
						this.log.error(err)
						return results
					}
				)
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
