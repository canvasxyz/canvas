import { Logger, logger } from "@libp2p/logger"

import { assert, deepEqual } from "@canvas-js/utils"

import { Config } from "./config.js"
import {
	ModelValue,
	Effect,
	Model,
	QueryParams,
	WhereCondition,
	ModelValueWithIncludes,
	PrimaryKeyValue,
	DatabaseAPI,
	DatabaseUpgradeAPI,
} from "./types.js"
import { getFilter } from "./query.js"
import { Awaitable, getModelsFromInclude, mergeModelValues, updateModelValues } from "./utils.js"

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

export abstract class AbstractModelDB implements DatabaseAPI {
	public static namespace = "modeldb"
	public static version = 1

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
		newConfig: Config,
		newVersion: Record<string, number>,
		upgrade: (oldConfig: Config, oldVersion: Record<string, number>) => Promise<void>,
	) {
		const timestamp = new Date().toISOString()

		const baseEffects: Effect[] = []

		const [oldModelDBVersion = null] = await baseModelDB.query<{ namespace: string; version: number }>("$versions", {
			select: { namespace: true, version: true },
			limit: 1,
			where: { namespace: AbstractModelDB.namespace },
			orderBy: { "namespace/version": "desc" },
		})

		if (oldModelDBVersion === null) {
			const versionValue = { namespace: AbstractModelDB.namespace, version: AbstractModelDB.version, timestamp }
			baseEffects.push({ model: "$versions", operation: "set", value: versionValue })

			for (const [name, model] of Object.entries(Config.baseModels)) {
				baseEffects.push({ model: "$models", operation: "set", value: { name, model } })
			}

			for (const model of newConfig.models) {
				baseEffects.push({ model: "$models", operation: "set", value: { name: model.name, model } })
			}
		} else if (oldModelDBVersion.version < AbstractModelDB.version) {
			// FUTURE: ModelDB internal upgrades (to $versions and $models) go here
			throw new Error(`unsupported modeldb version`)
		} else if (oldModelDBVersion.version > AbstractModelDB.version) {
			throw new Error(`unsupported modeldb version`)
		}

		await baseModelDB.apply(baseEffects)

		const existingVersions = await baseModelDB.getAll<{ namespace: string; version: number; timestamp: string }>(
			"$versions",
		)
		const oldVersion: Record<string, number> = {}
		for (const { namespace, version } of existingVersions) {
			assert(Number.isSafeInteger(version) && version >= 0, "internal error - found invalid version number")
			oldVersion[namespace] = Math.max(oldVersion[namespace] ?? 0, version)
		}

		const oldModels = await baseModelDB.getAll<{ name: string; model: Model }>("$models")
		const oldConfig = new Config(oldModels.map(({ model }) => model))
		const newEntries = Object.entries(newVersion).map(([namespace, version]) => ({ namespace, version, timestamp }))

		if (deepEqual(newVersion, oldVersion)) {
			// strict version equality
			// assert strict config equality
			Config.assertEqual(newConfig, oldConfig)
		} else if (newEntries.every(({ namespace, version }) => oldVersion[namespace] === version)) {
			// soft version equality
			// assert soft config equality
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

			await baseModelDB.apply(
				newEntries
					.filter(({ namespace, version }) => oldVersion[namespace] === undefined || oldVersion[namespace] < version)
					.map((value) => ({ model: "$versions", operation: "set", value })),
			)
		}
	}

	abstract getType(): ModelDBBackend

	abstract close(): Promise<void>

	abstract get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Awaitable<T | null>

	abstract getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Awaitable<T[]>

	abstract getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Awaitable<(T | null)[]>

	abstract iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query?: QueryParams,
	): AsyncIterable<T>

	abstract query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Awaitable<T[]>

	abstract count(modelName: string, where?: WhereCondition): Awaitable<number>

	abstract clear(modelName: string): Awaitable<void>

	// Batch effect API

	public abstract apply(effects: Effect[]): Awaitable<void>

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
			results: Promise.resolve(this.query(modelName, query)).then(async (results) => {
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
