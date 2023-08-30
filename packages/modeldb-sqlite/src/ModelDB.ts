import Database, * as sqlite from "better-sqlite3"

import {
	AbstractModelDB,
	Effect,
	ModelValue,
	ModelsInit,
	QueryParams,
	Resolver,
	parseConfig,
} from "@canvas-js/modeldb-interface"

import { initializeModel, initializeRelation } from "./initialize.js"
import { assert, signalInvalidType } from "./utils.js"
import { prepareImmutableModelAPI, prepareMutableModelAPI } from "./api.js"

export interface ModelDBOptions {
	resolver?: Resolver
}

export class ModelDB extends AbstractModelDB {
	public readonly db: sqlite.Database

	#immutableModelAPIs: Record<string, ReturnType<typeof prepareImmutableModelAPI>> = {}
	#mutableModelAPIs: Record<string, ReturnType<typeof prepareMutableModelAPI>> = {}
	#transaction: sqlite.Transaction<(effects: Effect[], version: string) => void>

	constructor(public readonly path: string | null, models: ModelsInit, { resolver }: ModelDBOptions = {}) {
		super(parseConfig(models), resolver)

		this.db = new Database(path ?? ":memory:")

		for (const model of this.config.models) {
			initializeModel(model, (sql) => this.db.exec(sql))
		}

		for (const relation of this.config.relations) {
			initializeRelation(relation, (sql) => this.db.exec(sql))
		}

		for (const model of Object.values(this.models)) {
			if (model.kind == "immutable") {
				this.#immutableModelAPIs[model.name] = prepareImmutableModelAPI(this.db, model)
			} else if (model.kind == "mutable") {
				assert(resolver !== undefined) // TODO: ???
				this.#mutableModelAPIs[model.name] = prepareMutableModelAPI(this.db, model, resolver)
			} else {
				signalInvalidType(model.kind)
			}
		}

		this.#transaction = this.db.transaction((effects, version: string) => {
			for (const effect of effects) {
				const model = this.models[effect.model]
				assert(model !== undefined, `model ${effect.model} not found`)
				if (effect.operation === "add") {
					assert(model.kind == "immutable", "cannot call .add on a mutable model")
					this.#immutableModelAPIs[effect.model].add(effect.value)
				} else if (effect.operation === "remove") {
					assert(model.kind == "immutable", "cannot call .remove on a mutable model")
					this.#immutableModelAPIs[effect.model].remove(effect.key)
				} else if (effect.operation === "set") {
					assert(model.kind == "mutable", "cannot call .set on an immutable model")
					this.#mutableModelAPIs[effect.model].set(effect.key, effect.value, version)
				} else if (effect.operation === "delete") {
					assert(model.kind == "mutable", "cannot call .delete on an immutable model")
					this.#mutableModelAPIs[effect.model].delete(effect.key, version)
				} else {
					signalInvalidType(effect)
				}
			}
		})
	}

	public async close() {
		this.db.close()
	}

	public async apply(effects: Effect[], options: { version?: string } = {}) {
		this.#transaction(effects, options.version ?? "") // TODO: ???
	}

	public async get(modelName: string, key: string) {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)

		if (model.kind == "mutable") {
			return this.#mutableModelAPIs[modelName].get(key)
		} else if (model.kind == "immutable") {
			return this.#mutableModelAPIs[modelName].get(key)
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)
		if (model.kind == "mutable") {
			yield* this.#mutableModelAPIs[modelName].iterate()
		} else if (model.kind == "immutable") {
			yield* this.#immutableModelAPIs[modelName].iterate()
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async query(modelName: string, query: QueryParams): Promise<ModelValue[]> {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)

		if (model.kind == "mutable") {
			return this.#mutableModelAPIs[modelName].query(query)
		} else if (model.kind == "immutable") {
			return this.#immutableModelAPIs[modelName].query(query)
		} else {
			signalInvalidType(model.kind)
		}
	}

	public async count(modelName: string): Promise<number> {
		const model = this.models[modelName]
		assert(model !== undefined, "model not found")

		if (model.kind == "mutable") {
			return this.#mutableModelAPIs[modelName].count()
		} else if (model.kind == "immutable") {
			return this.#immutableModelAPIs[modelName].count()
		} else {
			signalInvalidType(model.kind)
		}
	}
}
