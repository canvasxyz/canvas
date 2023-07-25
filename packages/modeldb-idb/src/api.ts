import {
	ImmutableModelAPI,
	ImmutableRecordAPI,
	Model,
	MutableModelAPI,
	MutableRecordAPI,
	RelationAPI,
	TombstoneAPI,
} from "@canvas-js/modeldb-interface"
import { IDBPDatabase } from "idb"

export const getRecordTableName = (modelName: string) => `record/${modelName}`
export const getTombstoneTableName = (modelName: string) => `tombstone/${modelName}`
export const getRelationTableName = (modelName: string, propertyName: string) => `relation/${modelName}/${propertyName}`

export const getPropertyIndexName = (modelName: string, index: string[]) => `record/${modelName}/${index.join("/")}`

export const getRelationSourceIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/source`

export const getRelationTargetIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/target`

function prepareTombstoneAPI(db: IDBPDatabase, model: Model): TombstoneAPI {
	const tombstoneTableName = getTombstoneTableName(model.name)

	return {
		select: ({ _key }) => db.get(tombstoneTableName, _key),
		delete: ({ _key }) => db.delete(tombstoneTableName, _key),
		insert: async ({ _key, _metadata, _version }) => {
			await db.put(tombstoneTableName, { _key, _metadata, _version })
		},
		update: async ({ _key, _metadata, _version }) => {
			await db.put(tombstoneTableName, { _key, _metadata, _version })
		},
	}
}

function prepareRelationAPI(db: IDBPDatabase, modelName: string, propertyName: string): RelationAPI {
	const tableName = getRelationTableName(modelName, propertyName)

	return {
		selectAll: ({ _source }) => db.getAll(tableName, _source),
		deleteAll: ({ _source }) => db.delete(tableName, _source),
		create: async ({ _source, _target }) => {
			db.put(tableName, { _source, _target })
		},
	}
}

function prepareRelationAPIs(db: IDBPDatabase, model: Model): Record<string, RelationAPI> {
	const relations: Record<string, RelationAPI> = {}
	for (const property of model.properties) {
		if (property.kind === "relation") {
			relations[property.name] = prepareRelationAPI(db, model.name, property.name)
		}
	}

	return relations
}

function prepareMutableRecordAPI(db: IDBPDatabase, model: Model): MutableRecordAPI {
	const recordTableName = getRecordTableName(model.name)

	return {
		select: async ({ _key }) => db.get(recordTableName, _key),
		iterateSync: function* () {},
		iterate: async function* () {
			for (const x in db.getAll(recordTableName)) {
				yield x as any
			}
		},
		selectAll: async () => db.getAll(recordTableName),
		insert: async ({ _key, _metadata, _version }) => {
			db.put(recordTableName, { _key, _metadata, _version })
		},
		update: async ({ _key, _metadata, _version }) => {
			db.put(recordTableName, { _key, _metadata, _version })
		},
		delete: async ({ _key }) => db.delete(recordTableName, _key),
		selectVersion: async ({ _key }) => {
			const record = await db.get(recordTableName, _key)
			return record ? { _version: record._version } : null
		},
	}
}

function prepareImmutableRecordAPI(db: IDBPDatabase, model: Model): ImmutableRecordAPI {
	const recordTableName = getRecordTableName(model.name)

	return {
		select: async ({ _key }) => db.get(recordTableName, _key),
		iterate: async function* () {
			for (const value of await db.getAll(recordTableName)) {
				yield value
			}
		},
		selectAll: async () => db.getAll(recordTableName),
		insert: async ({ _key, _metadata }) => {
			db.put(recordTableName, { _key, _metadata })
		},
		update: async ({ _key, _metadata, _version }) => {
			db.put(recordTableName, { _key, _metadata, _version })
		},
		delete: async ({ _key }) => db.delete(recordTableName, _key),
	}
}

export function createIdbMutableModelAPI(
	db: IDBPDatabase,
	model: Model,
	options: { resolve?: (a: string, b: string) => string } = {}
) {
	const tombstoneAPI = prepareTombstoneAPI(db, model)
	const relations = prepareRelationAPIs(db, model)
	const records = prepareMutableRecordAPI(db, model)
	return new MutableModelAPI(tombstoneAPI, relations, records, model, options)
}

export function createIdbImmutableModelAPI(db: IDBPDatabase, model: Model, options: { dkLen?: number } = {}) {
	const relationAPIs = prepareRelationAPIs(db, model)
	const immutableRecordAPI = prepareImmutableRecordAPI(db, model)

	return new ImmutableModelAPI(relationAPIs, immutableRecordAPI, model, options)
}
