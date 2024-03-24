import pg from "pg"

import { AbstractModelDB } from "../AbstractModelDB.js"
import { parseConfig } from "../config.js"
import { ModelAPI } from "./api.js"
import { Effect, ModelValue, ModelsInit, QueryParams } from "../types.js"
import { assert, signalInvalidType } from "../utils.js"

export interface ModelDBOptions {
	client: pg.Client
	models: ModelsInit
	indexHistory?: Record<string, boolean>
}

export class ModelDB extends AbstractModelDB {
	public readonly client: pg.Client

	#models: Record<string, ModelAPI> = {}
	#doTransaction: (effects: Effect[]) => void

	constructor({ client, models, indexHistory }: ModelDBOptions) {
		super(parseConfig(models), { indexHistory })

		this.client = client

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.client, model)
		}

		this.#doTransaction = async (effects: Effect[]) => {
			await client.query("BEGIN")
			try {
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
				await client.query("COMMIT")
			} catch (e) {
				await client.query("ROLLBACK")
				throw e
			} finally {
				// client.release() // TODO: why is this unavailable?
			}
		}
	}

	public async close() {
		this.log("closing")
		this.client.end()
	}

	public async apply(effects: Effect[]) {
		this.#doTransaction(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				assert(api !== undefined, `model ${model} not found`)
				try {
					callback(await api.query(query))
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
		return (await api.query(query)) as T[]
	}
}
