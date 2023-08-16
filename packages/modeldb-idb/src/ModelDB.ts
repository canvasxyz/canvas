import { IDBPDatabase, openDB } from "idb"

import {
	AbstractModelDB,
	Config,
	Effect,
	ImmutableModelAPI,
	ModelsInit,
	MutableModelAPI,
	Resolve,
	parseConfig,
} from "@canvas-js/modeldb-interface"

import {
	createIdbImmutableModelAPI,
	createIdbMutableModelAPI,
	getPropertyIndexName,
	getRecordTableName,
	getRelationTableName,
	getTombstoneTableName,
} from "./api.js"
import { assert, signalInvalidType } from "./utils.js"

export interface ModelDBOptions {
	databaseName?: string
	resolve?: Resolve
	dkLen?: number
}

export class ModelDB extends AbstractModelDB {
	public static async initialize(models: ModelsInit, options?: ModelDBOptions) {
		const config = parseConfig(models)

		for (const model of config.models) {
			const columnNames: string[] = []
			for (const [i, property] of model.properties.entries()) {
				if (property.kind === "primitive" || property.kind === "reference") {
					columnNames.push(`"${property.name}"`)
				} else if (property.kind === "relation") {
					continue
				} else {
					signalInvalidType(property)
				}
			}
			if (columnNames.length == 0) {
				throw new Error(`Model "${model.name}" has no columns`)
			}
		}

		const db = await openDB(options?.databaseName || "modeldb", 1, {
			upgrade(db: any) {
				// create model stores
				for (const model of config.models) {
					const recordObjectStore = db.createObjectStore(getRecordTableName(model.name))
					if (model.kind == "mutable") {
						db.createObjectStore(getTombstoneTableName(model.name))
					}
					for (const index of model.indexes) {
						const sortedIndex = typeof index === "string" ? [index] : index.sort()
						recordObjectStore.createIndex(getPropertyIndexName(model.name, sortedIndex), sortedIndex)
					}
				}

				for (const relation of config.relations) {
					const relationObjectStore = db.createObjectStore(getRelationTableName(relation.source, relation.property))
					relationObjectStore.createIndex("_source", "_source")
				}
			},
		})

		return new ModelDB(db, config, options)
	}

	constructor(public readonly db: IDBPDatabase, config: Config, options?: ModelDBOptions) {
		super(config)

		for (const model of config.models) {
			if (model.kind === "immutable") {
				this.apis[model.name] = createIdbImmutableModelAPI(this.db, model, options)
			} else if (model.kind === "mutable") {
				this.apis[model.name] = createIdbMutableModelAPI(this.db, model, options)
			} else {
				signalInvalidType(model.kind)
			}
		}
	}

	public async apply(
		effects: Effect[],
		options: { namespace?: string | undefined; version?: string | undefined }
	): Promise<void> {
		const { version, namespace } = options
		for (const effect of effects) {
			if (effect.operation === "add") {
				const api = this.apis[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				assert(api instanceof ImmutableModelAPI, "cannot call .add on a mutable model")
				await api.add(effect.value, { namespace })
			} else if (effect.operation === "remove") {
				const api = this.apis[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				assert(api instanceof ImmutableModelAPI, "cannot call .remove on a mutable model")
				await api.remove(effect.key)
			} else if (effect.operation === "set") {
				const api = this.apis[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				assert(api instanceof MutableModelAPI, "cannot call .set on an immutable model")
				await api.set(effect.key, effect.value, { version })
			} else if (effect.operation === "delete") {
				const api = this.apis[effect.model]
				assert(api !== undefined, `model ${effect.model} not found`)
				assert(api instanceof MutableModelAPI, "cannot call .delete on an immutable model")
				await api.delete(effect.key, { version })
			} else {
				signalInvalidType(effect)
			}
		}
	}

	close() {
		this.db.close()
	}
}
