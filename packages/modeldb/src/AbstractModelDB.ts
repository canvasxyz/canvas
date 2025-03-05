import { Logger, logger } from "@libp2p/logger"

import { assert, deepEqual } from "@canvas-js/utils"

import { Config } from "./config.js"
import {
	Awaitable,
	ModelValue,
	Effect,
	Model,
	QueryParams,
	WhereCondition,
	ModelValueWithIncludes,
	PrimaryKeyValue,
	DatabaseAPI,
	DatabaseUpgradeAPI,
	ModelSchema,
} from "./types.js"
import { getFilter } from "./query.js"
import { getModelsFromInclude, mergeModelValues, updateModelValues } from "./utils.js"

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>
}

export type ModelDBBackend =
	| "idb"
	| "postgres"
	| "sqlite-disk"
	| "sqlite-memory"
	| "sqlite-wasm"
	| "sqlite-expo"
	| "sqlite-durable-objects"

export type DatabaseUpgradeCallback = (
	upgradeAPI: DatabaseUpgradeAPI,
	oldConfig: Config,
	oldVersion: Record<string, number>,
	newVersion: Record<string, number>,
) => void | Promise<void>

export interface ModelDBInit {
	models: ModelSchema

	version?: Record<string, number>
	upgrade?: DatabaseUpgradeCallback
	initialUpgradeVersion?: Record<string, number>
	initialUpgradeSchema?: ModelSchema

	clear?: boolean
}

export abstract class AbstractModelDB implements DatabaseAPI {
	public static namespace = "modeldb"
	public static version = 1
	protected static baseVersion = {
		[AbstractModelDB.namespace]: AbstractModelDB.version,
	}

	public readonly models: Record<string, Model>

	protected readonly log: Logger
	protected readonly subscriptions = new Map<number, Subscription>()
	#subscriptionId = 0

	protected constructor(public readonly config: Config, public readonly version: Record<string, number>) {
		this.log = logger(`canvas:modeldb`)
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	protected static async initialize(
		baseModelDB: DatabaseAPI,
		timestamp: string,
		initialVersion: Record<string, number>,
		initialConfig: Config,
	) {
		const log = logger("canvas:modeldb:initialize")
		log("setting initial version %o", initialVersion)
		const initialEffects: Effect[] = []
		for (const [namespace, version] of Object.entries(initialVersion)) {
			initialEffects.push({ model: "$versions", operation: "set", value: { namespace, version, timestamp } })
		}

		for (const model of initialConfig.models) {
			log("creating initial model %s", model.name)
			initialEffects.push({ model: "$models", operation: "set", value: { name: model.name, model } })
		}

		log.trace("applying %o", initialEffects)
		await baseModelDB.apply(initialEffects)
	}

	protected static async getVersion(baseModelDB: DatabaseAPI) {
		const result: Record<string, number> = {}
		const versions = await baseModelDB.getAll<{ namespace: string; version: number }>("$versions")
		for (const { namespace, version } of versions) {
			assert(Number.isSafeInteger(version) && version >= 0, "internal error - found invalid version number")
			result[namespace] = Math.max(result[namespace] ?? 0, version)
		}

		return result
	}

	protected static async upgrade(
		baseModelDB: DatabaseAPI,
		timestamp: string,
		newVersion: Record<string, number>,
		newConfig: Config,
		upgrade: (oldConfig: Config, oldVersion: Record<string, number>) => Promise<void>,
	) {
		const log = logger(`canvas:modeldb:upgrade`)
		log("opening version %o", newVersion)

		const oldVersion = await AbstractModelDB.getVersion(baseModelDB)
		log("found existing version %o", oldVersion)

		const oldModelDBVersion = oldVersion[AbstractModelDB.namespace]
		if (oldModelDBVersion === undefined) {
			throw new Error(`internal error - missing modeldb version`)
		} else if (oldModelDBVersion < AbstractModelDB.version) {
			// FUTURE: ModelDB internal upgrades (to $versions and $models) go here
			throw new Error(`unsupported modeldb version`)
		} else if (oldModelDBVersion > AbstractModelDB.version) {
			throw new Error(`unsupported modeldb version`)
		}

		const oldModels = await baseModelDB.getAll<{ name: string; model: Model }>("$models")
		const oldConfig = new Config(oldModels.map(({ model }) => model))
		const newEntries = Object.entries(newVersion).map(([namespace, version]) => ({ namespace, version, timestamp }))

		if (deepEqual(newVersion, oldVersion)) {
			// strict version equality -> assert strict config equality
			log("existing version is strictly equal to the provided version")
			Config.assertEqual(newConfig, oldConfig)
		} else if (newEntries.every(({ namespace, version }) => oldVersion[namespace] === version)) {
			// soft version equality -> assert soft config equality
			log("existing version is compatible with the provided version")
			for (const newModel of newConfig.models) {
				const oldModel = oldConfig.models.find((model) => model.name === newModel.name)
				if (oldModel === undefined) {
					throw new Error(`schema conflict - missing model ${newModel.name}`)
				} else {
					Config.assertEqualModel(newModel, oldModel)
				}
			}
		} else {
			// check for conflict
			for (const { namespace, version } of newEntries) {
				if (namespace in oldVersion && version < oldVersion[namespace]) {
					const given = `${namespace} = ${version}`
					const found = `${namespace} = ${oldVersion[namespace]}`
					throw new Error(`version conflict - given ${given}, found ${found}`)
				}
			}

			// upgrade required
			const upgradeEntries = newEntries.filter(
				({ namespace, version }) => oldVersion[namespace] === undefined || oldVersion[namespace] < version,
			)

			log("upgrade required for entries %o", upgradeEntries)

			// sanity check assert
			assert(upgradeEntries.length > 0, "internal error - expected upgrade")

			await upgrade(oldConfig, oldVersion)

			// now we expect that existingConfig has been mutated to match config
			if (Object.entries(oldVersion).every(([namespace]) => namespace in newVersion)) {
				// assert strict equality
				Config.assertEqual(oldConfig, newConfig)
			} else {
				// assert soft equality
				for (const newModel of newConfig.models) {
					const oldModel = oldConfig.models.find((model) => model.name === newModel.name)
					if (oldModel === undefined) {
						throw new Error(`schema conflict - missing model ${newModel.name}`)
					} else {
						Config.assertEqualModel(oldModel, newModel)
					}
				}
			}

			await baseModelDB.apply(upgradeEntries.map((value) => ({ model: "$versions", operation: "set", value })))
		}

		log("upgrade complete")
	}

	protected abstract hasModel(model: Model): Awaitable<boolean>

	protected async satisfies(config: Config) {
		for (const model of config.models) {
			const hasModel = await this.hasModel(model)
			if (!hasModel) {
				return false
			}
		}

		return true
	}

	abstract getType(): ModelDBBackend

	abstract close(): Promise<void>

	abstract get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Promise<T | null>

	abstract getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Promise<T[]>

	abstract getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Promise<(T | null)[]>

	abstract iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query?: QueryParams,
	): AsyncIterable<T>

	abstract query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]>

	abstract count(modelName: string, where?: WhereCondition): Promise<number>

	abstract clear(modelName: string): Promise<void>

	// Batch effect API

	public abstract apply(effects: Effect[]): Promise<void>

	// Model operations

	public async set<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		await this.apply([{ operation: "set", model: modelName, value }])
	}

	public async delete(modelName: string, key: PrimaryKeyValue | PrimaryKeyValue[]) {
		await this.apply([{ operation: "delete", model: modelName, key }])
	}

	public async update<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		const key = this.models[modelName].primaryKey.map((key) => value[key])
		const existingValue = await this.get<T>(modelName, key)
		const updatedValue = updateModelValues(value, existingValue)
		await this.apply([{ operation: "set", model: modelName, value: updatedValue }])
	}

	public async merge<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T) {
		const key = this.models[modelName].primaryKey.map((key) => value[key])
		const existingValue = await this.get<T>(modelName, key)
		const mergedValue = mergeModelValues(value, existingValue)
		await this.apply([{ operation: "set", model: modelName, value: mergedValue }])
	}

	public subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>,
	): { id: number; results: Promise<ModelValue[]> } {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)

		const filter = this.getEffectFilter(model, query)
		const id = this.#subscriptionId++
		this.subscriptions.set(id, { model: modelName, query, filter, callback })

		return {
			id,
			results: this.query(modelName, query).then(async (results) => {
				try {
					await callback(results)
				} catch (err) {
					this.log.error(err)
				}

				return results
			}),
		}
	}

	public unsubscribe(id: number) {
		this.subscriptions.delete(id)
	}

	protected getEffectFilter(model: Model, query: QueryParams): (effect: Effect) => boolean {
		const filter = getFilter(model, query.where)

		const includeModels = query.include
			? Array.from(getModelsFromInclude(this.config.models, model.name, query.include))
			: []

		return (effect) => {
			// TODO: we should memoize the set of joined models returned the last time
			// subscribe() triggered a callback, and check for inclusion in that set
			if (query.include && includeModels.includes(effect.model)) {
				return true
			}

			if (effect.model !== model.name) {
				return false
			}

			if (effect.operation === "set") {
				if (!filter(effect.value)) {
					return false
				}
			}

			// TODO: we could do more to filter out more effects:
			// - look up the previous value before deleting and see if it was a possible query result
			// - for queries with defined a order and limit, track the order property value of the
			//   last query result, and if the a new value is set with a later order property value,
			//   filter the effect out.

			return true
		}
	}
}
