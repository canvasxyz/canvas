import pg from "pg"

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
	models: ModelSchema
	clear?: boolean

	version?: Record<string, number>
	upgrade?: (
		upgradeAPI: DatabaseUpgradeAPI,
		oldVersion: Record<string, number>,
		newVersion: Record<string, number>,
	) => void | Promise<void>
}

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	#transaction: (effects: Effect[]) => Promise<void>

	public static async open(uri: string | pg.ConnectionConfig, { models, version, upgrade, clear }: ModelDBOptions) {
		const newConfig = Config.parse(models)
		const newVersion = Object.assign(version ?? {}, {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		const client = new pg.Client(uri)
		await client.connect()

		try {
			const baseModelDB = new ModelDB(client, Config.baseConfig, {
				[AbstractModelDB.namespace]: AbstractModelDB.version,
			})

			for (const model of Config.baseConfig.models) {
				baseModelDB.#models[model.name] = await ModelAPI.create(client, newConfig, model, clear)
			}

			await AbstractModelDB.initialize(baseModelDB, newConfig, newVersion, async (oldConfig, oldVersion) => {
				if (upgrade !== undefined) {
					const existingDB = new ModelDB(client, oldConfig, oldVersion)
					for (const model of oldConfig.models) {
						existingDB.#models[model.name] = await ModelAPI.create(client, oldConfig, model, clear)
					}

					const upgradeAPI = existingDB.getUpgradeAPI()
					await upgrade(upgradeAPI, oldVersion, newVersion)
				}
			})

			newConfig.freeze()

			const modelDB = new ModelDB(client, newConfig, newVersion)
			for (const model of newConfig.models) {
				modelDB.#models[model.name] = await ModelAPI.create(client, newConfig, model, clear)
			}

			return modelDB
		} catch (e) {
			await client.end()
			throw e
		}
	}

	private constructor(public readonly client: pg.Client, config: Config, version: Record<string, number>) {
		super(config, version)

		this.#transaction = async (effects: Effect[]) => {
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

	public getType(): ModelDBBackend {
		return "postgres"
	}

	public async close() {
		this.log("closing")
		await this.client.end()
	}

	public async apply(effects: Effect[]) {
		await this.#transaction(effects)

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

	public get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.get(key) as Promise<T | null>
	}

	public getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getAll() as Promise<T[]>
	}

	public getMany<T extends ModelValue>(modelName: string, keys: string[]): Promise<(T | null)[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.getMany(keys) as Promise<(T | null)[]>
	}

	public async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query: QueryParams = {},
	): AsyncIterable<T> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		yield* api.iterate(query) as AsyncIterable<T>
	}

	public count(modelName: string, where?: WhereCondition): Promise<number> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.count(where)
	}

	public clear(modelName: string): Promise<void> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.clear()
	}

	public query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		const api = this.#models[modelName]
		if (api === undefined) {
			throw new Error(`model ${modelName} not found`)
		}

		return api.query(query) as Promise<T[]>
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

			createModel: async (name: string, init: ModelInit) => {
				const model = this.config.createModel(name, init)
				this.models[name] = model
				this.#models[name] = await ModelAPI.create(this.client, this.config, model)
				await this.#models.$models.set({ name, model })
			},

			deleteModel: async (name: string) => {
				this.config.deleteModel(name)
				await this.#models[name].drop()
				delete this.#models[name]
				delete this.models[name]
				await this.#models.$models.delete(name)
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
