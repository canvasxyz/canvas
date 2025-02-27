import { signalInvalidType } from "@canvas-js/utils"
import { Awaitable } from "@canvas-js/interfaces"
import {
	AbstractModelDB,
	ModelDBBackend,
	Config,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	WhereCondition,
	ModelValueWithIncludes,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
} from "@canvas-js/modeldb"

import { SqlStorage } from "@cloudflare/workers-types"

import { ModelAPI } from "./ModelAPI.js"

export interface ModelDBOptions {
	db: SqlStorage
	models: ModelSchema

	version?: Record<string, number>
	upgrade?: (
		upgradeAPI: DatabaseUpgradeAPI,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) => void | Promise<void>
}

export class ModelDB extends AbstractModelDB {
	#subscriptionId = 0
	#models: Record<string, ModelAPI> = {}

	public static async open({ db, models, version, upgrade }: ModelDBOptions) {
		const newConfig = Config.parse(models)
		const newVersion = Object.assign(version ?? {}, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		// calling this constructor will create empty $versions and $models
		// tables if they do not already exist
		const baseModelDB = new ModelDB(db, Config.baseConfig, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		await AbstractModelDB.initialize(baseModelDB, newConfig, newVersion, async (oldConfig, oldVersion) => {
			if (upgrade !== undefined) {
				const existingDB = new ModelDB(db, oldConfig, oldVersion)
				const upgradeAPI = existingDB.getUpgradeAPI()
				await upgrade(upgradeAPI, oldVersion, newVersion)
			}
		})

		newConfig.freeze()
		return new ModelDB(db, newConfig, newVersion)
	}

	private constructor(public readonly db: SqlStorage, config: Config, version: Record<string, number>) {
		super(config, version)

		for (const model of Object.values(this.models)) {
			this.#models[model.name] = new ModelAPI(this.db, this.config, model)
		}
	}

	public getType(): ModelDBBackend {
		return "sqlite-durable-objects"
	}

	public async close() {
		this.log("closing")
	}

	public apply(effects: Effect[]) {
		// From https://developers.cloudflare.com/durable-objects/api/storage-api/#transaction
		// > Explicit transactions are no longer necessary. Any series of write
		// > operations with no intervening await will automatically be submitted
		// > atomically, and the system will prevent concurrent events from executing
		// > while await a read operation (unless you use allowConcurrency: true).
		// > Therefore, a series of reads followed by a series of writes (with no other
		// > intervening I/O) are automatically atomic and behave like a transaction

		for (const effect of effects) {
			const model = this.models[effect.model]
			if (model === undefined) {
				throw new Error(`model ${effect.model} not found`)
			}

			if (effect.operation === "set") {
				this.#models[effect.model].set(effect.value)
			} else if (effect.operation === "delete") {
				this.#models[effect.model].delete(effect.key)
			} else {
				signalInvalidType(effect)
			}
		}

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				const api = this.#models[model]
				if (api === undefined) {
					throw new Error(`model ${model} not found`)
				}

				try {
					callback(api.query(query))
				} catch (err) {
					this.log.error(err)
				}
			}
		}
	}

	public async get<T extends ModelValue<any> = ModelValue<any>>(modelName: string, key: string): Promise<T | null> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.get(key) as T | null
	}

	public async getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getAll() as T[]
	}

	public async getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		keys: string[],
	): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}
		return api.getMany(keys) as (T | null)[]
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		yield* api.iterate(query) as Iterable<T>
	}

	public async count(modelName: string, where?: WhereCondition): Promise<number> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}
		return api.count(where)
	}

	public async clear(modelName: string): Promise<void> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.clear()
	}

	public async query<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}
		return api.query(query) as T[]
	}

	public subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>,
	): { id: number; results: Promise<ModelValue[]> } {
		const model = this.models[modelName]
		if (model === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		const filter = this.getEffectFilter(model, query)
		const id = this.#subscriptionId++
		this.subscriptions.set(id, { model: modelName, query, filter, callback })

		return {
			id,
			results: this.query(modelName, query).then((results) =>
				Promise.resolve(callback(results)).then(
					() => results,
					(err) => {
						this.log.error(err)
						return results
					},
				),
			),
		}
	}

	public unsubscribe(id: number) {
		this.subscriptions.delete(id)
	}

	private createModel(name: string, init: ModelInit) {
		const model = this.config.createModel(name, init)
		this.models[name] = model
		this.#models[name] = new ModelAPI(this.db, this.config, model)
		this.#models.$models.set({ name, model })
	}

	private deleteModel(name: string) {
		this.config.deleteModel(name)
		this.#models[name].drop()
		delete this.#models[name]
		delete this.models[name]
		this.#models.$models.delete(name)
	}

	private addProperty(modelName: string, propertyName: string, propertyType: PropertyType) {
		const property = this.config.addProperty(modelName, propertyName, propertyType)
		throw new Error("not implemented")
	}

	private removeProperty(modelName: string, propertyName: string) {
		this.config.removeProperty(modelName, propertyName)
		throw new Error("not implemented")
	}

	private addIndex(modelName: string, index: string) {
		const propertyNames = this.config.addIndex(modelName, index)
		throw new Error("not implemented")
	}

	private removeIndex(modelName: string, index: string) {
		this.config.removeIndex(modelName, index)
		throw new Error("not implemented")
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

			createModel: this.createModel.bind(this),
			deleteModel: this.deleteModel.bind(this),
			addProperty: this.addProperty.bind(this),
			removeProperty: this.removeProperty.bind(this),
			addIndex: this.addIndex.bind(this),
			removeIndex: this.removeIndex.bind(this),
		} satisfies DatabaseUpgradeAPI
	}
}
