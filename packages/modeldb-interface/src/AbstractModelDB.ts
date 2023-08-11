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
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof MutableModelAPI, "cannot call .set on an immutable model")
		await api.set(key, value, options)
	}

	public async delete(modelName: string, key: string, options: { metadata?: string; version?: string } = {}) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof MutableModelAPI, "cannot call .delete on an immutable model")
		await api.delete(key, options)
	}

	// Immutable model methods

	public async add(modelName: string, value: ModelValue, options: { metadata?: string; namespace?: string } = {}) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof ImmutableModelAPI, "cannot call .add on a mutable model")
		return await api.add(value, options)
	}

	public async remove(modelName: string, key: string) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof ImmutableModelAPI, "cannot call .remove on a mutable model")
		await api.remove(key)
	}

	// Batch effect API

	public async apply(effects: Effect[], options: { namespace?: string; version?: string } = {}): Promise<void> {
		const { version, namespace } = options
		for (const effect of effects) {
			if (effect.operation === "add") {
				await this.add(effect.model, effect.value, { namespace })
			} else if (effect.operation === "remove") {
				await this.remove(effect.model, effect.key)
			} else if (effect.operation === "set") {
				await this.set(effect.model, effect.key, effect.value, { version })
			} else if (effect.operation === "delete") {
				await this.delete(effect.model, effect.key, { version })
			} else {
				signalInvalidType(effect)
			}
		}
	}
}
