import pg from "pg"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	AbstractModelDB,
	ModelDBBackend,
	Config,
	Effect,
	ModelValue,
	QueryParams,
	WhereCondition,
	DatabaseUpgradeAPI,
	ModelInit,
	PropertyType,
	Model,
	ModelDBInit,
} from "@canvas-js/modeldb"

import { ModelAPI } from "./ModelAPI.js"
import { Query } from "./utils.js"

export class ModelDB extends AbstractModelDB {
	#models: Record<string, ModelAPI> = {}
	#transaction: (effects: Effect[]) => Promise<void>
	#selectTable: Query<{ name: string }>
	#selectIndex: Query<{ name: string }>

	public static async open(uri: string | pg.ConnectionConfig, init: ModelDBInit) {
		const newConfig = Config.parse(init.models, { freeze: true })
		const newVersion = Object.assign(init.version ?? {}, AbstractModelDB.baseVersion)

		const client = new pg.Client(uri)
		await client.connect()

		try {
			const timestamp = new Date().toISOString()

			if (init.clear) {
				const modelDB = new ModelDB(client, newConfig, newVersion)
				for (const model of newConfig.models) {
					modelDB.#models[model.name] = await ModelAPI.create(client, newConfig, model, true)
				}

				for (const model of newConfig.models) {
					await modelDB.#models.$models.set({ name: model.name, model })
				}

				for (const [namespace, version] of Object.entries(newVersion)) {
					await modelDB.#models.$versions.set({ namespace, version, timestamp })
				}

				return modelDB
			}

			const baseModelDB = new ModelDB(client, Config.baseConfig, AbstractModelDB.baseVersion)
			for (const model of Config.baseConfig.models) {
				baseModelDB.#models[model.name] = await ModelAPI.create(client, newConfig, model)
			}

			const versionRecordCount = await baseModelDB.count("$versions")
			if (versionRecordCount === 0) {
				// this means one of two things:
				// 1) we are initializing a new database, or
				// 2) we are opening a pre-migration-system database for the first time

				baseModelDB.log("no version records found")
				const initialUpgradeVersion = Object.assign(
					init.initialUpgradeVersion ?? init.version ?? {},
					AbstractModelDB.baseVersion,
				)
				const initialUpgradeConfig = init.initialUpgradeSchema ? Config.parse(init.initialUpgradeSchema) : newConfig

				// we distinguish between these cases using baseModelDB.satisfies(...).
				const isSatisfied = await baseModelDB.satisfies(initialUpgradeConfig)
				if (isSatisfied) {
					baseModelDB.log("existing database satisfies initial upgrade config")
					// now we write initialUpgradeConfig entries to $models
					// and write initialUpgradeVersion entries to $versions
					await AbstractModelDB.initialize(baseModelDB, timestamp, initialUpgradeVersion, initialUpgradeConfig)
				} else {
					baseModelDB.log("existing database not satisfied by initial upgrade config")
					// we ignore initialUpgradeVersion / initialUpgradeConfig and just
					// initialize directly with newVersion / newConfig
					await AbstractModelDB.initialize(baseModelDB, timestamp, newVersion, newConfig)
				}
			}

			// now means we proceed with the regular upgrade check
			await AbstractModelDB.upgrade(baseModelDB, timestamp, newVersion, newConfig, async (oldConfig, oldVersion) => {
				if (init.upgrade !== undefined) {
					const existingDB = new ModelDB(client, oldConfig, oldVersion)
					for (const model of oldConfig.models) {
						existingDB.#models[model.name] = await ModelAPI.create(client, oldConfig, model)
					}

					const upgradeAPI = existingDB.getUpgradeAPI()
					await init.upgrade(upgradeAPI, oldConfig, oldVersion, newVersion)
				}
			})

			const modelDB = new ModelDB(client, newConfig, newVersion)
			for (const model of newConfig.models) {
				modelDB.#models[model.name] = await ModelAPI.create(client, newConfig, model)
			}

			return modelDB
		} catch (err) {
			await client.end()
			throw err
		}
	}

	private constructor(public readonly client: pg.Client, config: Config, version: Record<string, number>) {
		super(config, version)

		this.#selectTable = new Query(
			client,
			`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
		)
		this.#selectIndex = new Query(
			client,
			`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 AND tablename = $2`,
		)

		this.#transaction = async (effects: Effect[]) => {
			this.log.trace("beginning transaction")
			await client.query("BEGIN")
			try {
				for (const effect of effects) {
					const model = this.models[effect.model]
					if (model === undefined) {
						throw new Error(`model ${effect.model} not found`)
					}

					if (effect.operation === "set") {
						await this.#models[effect.model].set(effect.value)
					} else if (effect.operation === "delete") {
						await this.#models[effect.model].delete(effect.key)
					} else {
						signalInvalidType(effect)
					}
				}
				await client.query("COMMIT")
				this.log.trace("transaction committed")
			} catch (e) {
				await client.query("ROLLBACK")
				throw e
			}
		}
	}

	protected async hasModel(model: Model): Promise<boolean> {
		const tableName = model.name
		const tableResult = await this.#selectTable.get([tableName])
		if (tableResult === null) {
			return false
		}

		for (const index of model.indexes) {
			const indexName = [model.name, ...index].join("/")
			const indexResult = await this.#selectIndex.get([indexName, tableName])
			if (indexResult === null) {
				return false
			}
		}

		return true
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
				if (api === undefined) {
					throw new Error(`model ${model} not found`)
				}

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

	private async createModel(name: string, init: ModelInit) {
		const model = this.config.createModel(name, init)
		this.models[name] = model
		this.#models[name] = await ModelAPI.create(this.client, this.config, model)
		await this.#models.$models.set({ name, model })
	}

	private async deleteModel(name: string) {
		this.config.deleteModel(name)
		await this.#models[name].drop()
		delete this.#models[name]
		delete this.models[name]
		await this.#models.$models.delete(name)
	}

	private async addProperty(modelName: string, propertyName: string, propertyType: PropertyType) {
		const property = this.config.addProperty(modelName, propertyName, propertyType)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		await this.#models[modelName].addProperty(property)
		await this.#models.$models.set({ name: modelName, model })
	}

	private async removeProperty(modelName: string, propertyName: string) {
		this.config.removeProperty(modelName, propertyName)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		await this.#models[modelName].removeProperty(propertyName)
		await this.#models.$models.set({ name: modelName, model })
	}

	private async addIndex(modelName: string, index: string) {
		const propertyNames = Config.parseIndex(index)
		this.config.addIndex(modelName, index)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		await this.#models[modelName].addIndex(propertyNames)
		await this.#models.$models.set({ name: modelName, model })
	}

	private async removeIndex(modelName: string, index: string) {
		const propertyNames = Config.parseIndex(index)
		this.config.removeIndex(modelName, index)

		const model = this.config.models.find((model) => model.name === modelName)
		assert(model !== undefined, "internal error")
		this.models[modelName] = model

		await this.#models[modelName].removeIndex(propertyNames)
		await this.#models.$models.set({ name: modelName, model })
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
