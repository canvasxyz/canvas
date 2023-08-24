import { Config, ModelValue, Effect, Model } from "./types.js"
import { getImmutableRecordKey } from "./utils.js"

export abstract class AbstractModelDB {
	public static getImmutableRecordKey = getImmutableRecordKey
	public readonly models: Record<string, Model>

	public constructor(public readonly config: Config) {
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	abstract close(): void

	abstract get(modelName: string, key: string): Promise<ModelValue | null>

	abstract selectAll(modelName: string): Promise<ModelValue[]>

	abstract iterate(modelName: string): AsyncIterable<ModelValue>

	abstract query(modelName: string, query: {}): Promise<ModelValue[]>

	abstract count(modelName: string): Promise<number>

	// Mutable model methods

	public async set(modelName: string, key: string, value: ModelValue, options: { version?: string } = {}) {
		await this.apply([{ operation: "set", model: modelName, key, value }], { version: options.version })
	}

	public async delete(modelName: string, key: string, options: { version?: string } = {}) {
		await this.apply([{ operation: "delete", model: modelName, key }], { version: options.version })
	}

	// Immutable model methods

	public async add(modelName: string, value: ModelValue, options: { namespace?: string } = {}) {
		await this.apply([{ operation: "add", model: modelName, value }], { namespace: options.namespace })
		return getImmutableRecordKey(value, { namespace: options.namespace })
	}

	public async remove(modelName: string, key: string) {
		await this.apply([{ operation: "remove", model: modelName, key }], {})
	}

	// Batch effect API
	abstract apply(effects: Effect[], options: { namespace?: string; version?: string }): Promise<void>
}
