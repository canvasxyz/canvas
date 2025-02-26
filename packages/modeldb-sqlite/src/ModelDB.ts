import Database, * as sqlite from "better-sqlite3"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	AbstractModelDB,
	ModelDBBackend,
	Config,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
	PrimaryKeyValue,
} from "@canvas-js/modeldb"

import { ModelAPI } from "./api.js"

export interface ModelDBOptions {
	path: string | null
	models: ModelSchema

	version?: Record<string, number>
	upgrade?: (
		db: DatabaseUpgradeAPI,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) => void | Promise<void>
}

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	#transaction: sqlite.Transaction<(effects: Effect[]) => void>

	public static async open({ path, models, version, upgrade }: ModelDBOptions): Promise<ModelDB> {
		const newConfig = Config.parse(models)
		const newVersion = Object.assign(version ?? {}, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		const db = new Database(path ?? ":memory:")

		const baseModelDB = new ModelDB(db, Config.baseConfig)
		await baseModelDB.initialize(newConfig, newVersion, async (oldConfig, oldVersion) => {
			if (upgrade !== undefined) {
				const existingDB = new ModelDB(db, oldConfig)
				const upgradeAPI = existingDB.getUpgradeAPI()
				await upgrade(upgradeAPI, oldVersion, newVersion)
			}
		})

		newConfig.freeze()
		return new ModelDB(db, newConfig)
	}

	private constructor(public readonly db: sqlite.Database, config: Config) {
		super(config)

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, this.config, model)
		}

		this.#transaction = this.db.transaction((effects) => {
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
		})
	}

	public getType(): ModelDBBackend {
		return this.db.memory ? "sqlite-memory" : "sqlite-disk"
	}

	public async close() {
		this.log("closing")
		this.db.close()
	}

	public apply(effects: Effect[]) {
		this.#transaction(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				assert(api !== undefined, `model ${model} not found`)
				try {
					callback(api.query(query))
				} catch (err) {
					this.log.error(err)
				}
			}
		}
	}

	public get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): T | null {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.get(key) as T | null
	}

	public getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): T[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getAll() as T[]
	}

	public getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): (T | null)[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.getMany(keys) as (T | null)[]
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		yield* api.iterate(query) as Iterable<T>
	}

	public count(modelName: string, where?: WhereCondition): number {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.count(where)
	}

	public clear(modelName: string) {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		api.clear()
	}

	public query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query: QueryParams = {}): T[] {
		const api = this.#models[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		return api.query(query) as T[]
	}

	private getUpgradeAPI() {
		return {
			get: this.get.bind(this),
			getAll: this.getAll.bind(this),
			getMany: this.getMany.bind(this),
			iterate: this.iterate.bind(this),
			query: this.query.bind(this),
			count: this.count.bind(this),
			clear: this.clear.bind(this),
			apply: this.apply.bind(this),
			set: this.set.bind(this),
			delete: this.delete.bind(this),

			createModel: (name: string, init: ModelInit) => {
				const model = this.config.createModel(name, init)
				this.models[name] = model
				this.#models[name] = new ModelAPI(this.db, this.config, model)
				this.#models.$models.set({ name, model })
			},

			deleteModel: (name: string) => {
				this.config.deleteModel(name)
				this.#models[name].drop()
				delete this.#models[name]
				delete this.models[name]
				this.#models.$models.delete(name)
			},

			addProperty: (modelName: string, propertyName: string, propertyType: PropertyType) => {
				const property = this.config.addProperty(modelName, propertyName, propertyType)
				throw new Error("not implemented")
			},

			removeProperty: (modelName: string, propertyName: string) => {
				this.config.removeProperty(modelName, propertyName)
				throw new Error("not implemented")
			},

			addIndex: (modelName: string, index: string) => {
				const propertyNames = this.config.addIndex(modelName, index)
				throw new Error("not implemented")
			},

			removeIndex: (modelName: string, index: string) => {
				this.config.removeIndex(modelName, index)
				throw new Error("not implemented")
			},
		} satisfies DatabaseUpgradeAPI
	}
}
