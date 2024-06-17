import pg from "pg"

import { assert, signalInvalidType } from "@canvas-js/utils"

import { AbstractModelDB } from "../AbstractModelDB.js"
import { parseConfig } from "../config.js"
import { ModelAPI } from "./api.js"
import { Config, Effect, ModelValue, ModelsInit, QueryParams } from "../types.js"

export interface ModelDBOptions {
	connectionConfig: string | pg.ConnectionConfig
	models: ModelsInit
	clear?: boolean
}

export class ModelDB extends AbstractModelDB {
	public readonly client: pg.Client

	#models: Record<string, ModelAPI> = {}
	#doTransaction: (effects: Effect[]) => void

	public static async initialize({ connectionConfig, models, clear }: ModelDBOptions) {
		const client = new pg.Client(connectionConfig)
		await client.connect()

		try {
			const modelDBConfig = parseConfig(models)

			const modelDBAPIs: Record<string, ModelAPI> = {}
			for (const model of Object.values(modelDBConfig.models)) {
				modelDBAPIs[model.name] = await ModelAPI.initialize(client, model, clear)
			}

			return new ModelDB(client, modelDBConfig, modelDBAPIs)
		} catch (e) {
			await client.end()
			throw e
		}
	}

	constructor(client: pg.Client, modelDBConfig: Config, modelAPIs: Record<string, ModelAPI>) {
		super(modelDBConfig)

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = modelAPIs[model.name]
		}

		this.client = client
		this.#doTransaction = async (effects: Effect[]) => {
			await client.query("BEGIN")
			try {
				for (const effect of effects) {
					const model = this.models[effect.model]
					assert(model !== undefined, `model ${effect.model} not found`)
					if (effect.operation === "set") {
						await this.#models[effect.model].set(effect.value)
					} else if (effect.operation === "delete") {
						await this.#models[effect.model].delete(effect.key)
					} else {
						signalInvalidType(effect)
					}
				}
				await client.query("COMMIT")
			} catch (e) {
				await client.query("ROLLBACK")
				throw e
			}
		}
	}

	public async close() {
		this.log("closing")
		await this.client.end()
	}

	public async apply(effects: Effect[]) {
		await this.#doTransaction(effects)

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

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as Promise<T | null>
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
