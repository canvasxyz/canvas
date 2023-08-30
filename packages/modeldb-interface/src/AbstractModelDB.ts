import { Config, ModelValue, Effect, Model, QueryParams, Resolver } from "./types.js"
import { getImmutableRecordKey } from "./utils.js"

export abstract class AbstractModelDB {
	public static getImmutableRecordKey = getImmutableRecordKey
	public readonly models: Record<string, Model>

	public constructor(public readonly config: Config, public readonly resolver?: Resolver) {
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	abstract close(): Promise<void>

	abstract get(modelName: string, key: string): Promise<ModelValue | null>

	abstract iterate(modelName: string): AsyncIterable<ModelValue>

	abstract query(modelName: string, query: QueryParams): Promise<ModelValue[]>

	abstract count(modelName: string): Promise<number>

	// Batch effect API
	public abstract apply(effects: Effect[], options: { version?: string }): Promise<void>

	// Mutable model methods

	public async set(modelName: string, key: string, value: ModelValue, options: { version?: string } = {}) {
		await this.apply([{ operation: "set", model: modelName, key, value }], { version: options.version })
	}

	public async delete(modelName: string, key: string, options: { version?: string } = {}) {
		await this.apply([{ operation: "delete", model: modelName, key }], { version: options.version })
	}

	// Immutable model methods

	public async add(modelName: string, value: ModelValue) {
		await this.apply([{ operation: "add", model: modelName, value }], {})
		return getImmutableRecordKey(value)
	}

	public async remove(modelName: string, key: string) {
		await this.apply([{ operation: "remove", model: modelName, key }], {})
	}
}
