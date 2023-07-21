import assert from "assert"
import { IModelDB, ModelValue, ModelsInit, parseConfig } from "@canvas-js/modeldb-interface"
import { openDB } from "idb"
import { ImmutableModelAPI, MutableModelAPI } from "./api.js"
import { signalInvalidType } from "./utils.js"

export interface ModelDBOptions {
	dkLen?: number
	resolve?: (versionA: string, versionB: string) => string
}

export class ModelDB implements IModelDB {
	private apis: Record<string, MutableModelAPI | ImmutableModelAPI> = {}

	public static async initialize(models: ModelsInit, options?: ModelDBOptions): Promise<ModelDB> {
		const config = parseConfig(models)

		const db = await openDB("modeldb", 1, {
			upgrade(db: any) {
				for (const model of config.models) {
					db.createObjectStore(model.name)
				}
			},
		})

		const apis: Record<string, MutableModelAPI | ImmutableModelAPI> = {}

		for (const model of config.models) {
			if (model.kind === "immutable") {
				apis[model.name] = new ImmutableModelAPI(db, model, options)
			} else if (model.kind === "mutable") {
				apis[model.name] = new MutableModelAPI(db, model, options)
			} else {
				signalInvalidType(model.kind)
			}
		}

		return new ModelDB(apis)
	}

	constructor(apis: Record<string, MutableModelAPI | ImmutableModelAPI>) {
		this.apis = apis
	}

	public async close() {}

	public async get(modelName: string, key: string) {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI) {
			return null
		} else if (api instanceof ImmutableModelAPI) {
			return api.get(key)
		} else {
			signalInvalidType(api)
		}
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI || api instanceof ImmutableModelAPI) {
			yield* api.iterate()
		}
	}

	public query(modelName: string, query: {}): AsyncIterable<ModelValue> {
		throw new Error("not implemented")
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
		api.set(key, value, options)
	}

	public async delete(modelName: string, key: string, options: { metadata?: string; version?: string } = {}) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof MutableModelAPI, "cannot call .delete on an immutable model")
		api.delete(key, options)
	}

	// Immutable model methods

	public async add(modelName: string, value: ModelValue, options: { metadata?: string; namespace?: string } = {}) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof ImmutableModelAPI, "cannot call .add on a mutable model")
		return api.add(value, options)
	}

	public async remove(modelName: string, key: string) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof ImmutableModelAPI, "cannot call .remove on a mutable model")
		api.remove(key)
	}
}
