import { Config, ModelValue, Effect } from "./types.js"
import { ImmutableModelAPI, MutableModelAPI } from "./api.js"
import { assert, signalInvalidType } from "./utils.js"
import { getImmutableRecordKey } from "./utils.js"

export abstract class AbstractModelDB {
	public static getImmutableRecordKey = getImmutableRecordKey
	public readonly apis: Record<string, MutableModelAPI | ImmutableModelAPI> = {}

	public constructor(public readonly config: Config) {}

	abstract close(): void

	public async get(modelName: string, key: string) {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI) {
			return null
		} else if (api instanceof ImmutableModelAPI) {
			return await api.get(key)
		} else {
			signalInvalidType(api)
		}
	}

	public async selectAll(modelName: string): Promise<ModelValue[]> {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI || api instanceof ImmutableModelAPI) {
			return await api.selectAll()
		} else {
			signalInvalidType(api)
		}
	}

	public iterate(modelName: string): AsyncIterable<ModelValue> {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI || api instanceof ImmutableModelAPI) {
			return api.iterate()
		} else {
			signalInvalidType(api)
		}
	}

	public async query(modelName: string, query: {}): Promise<ModelValue[]> {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI || api instanceof ImmutableModelAPI) {
			return api.query(query)
		} else {
			signalInvalidType(api)
		}
	}

	// Mutable model methods

	public async set(
		modelName: string,
		key: string,
		value: ModelValue,
		options: { metadata?: string; version?: string } = {}
	) {
		await this.apply([{ operation: "set", model: modelName, key, value }], { version: options.version })
	}

	public async delete(modelName: string, key: string, options: { metadata?: string; version?: string } = {}) {
		await this.apply([{ operation: "delete", model: modelName, key }], { version: options.version })
	}

	// Immutable model methods

	public async add(modelName: string, value: ModelValue, options: { metadata?: string; namespace?: string } = {}) {
		await this.apply([{ operation: "add", model: modelName, value }], { namespace: options.namespace })
		return getImmutableRecordKey(value, { namespace: options.namespace })
	}

	public async remove(modelName: string, key: string) {
		await this.apply([{ operation: "remove", model: modelName, key }], {})
	}

	// Batch effect API
	abstract apply(effects: Effect[], options: { namespace?: string; version?: string; metadata?: string }): Promise<void>
}
