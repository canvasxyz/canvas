import {
	ImmutableModelAPI,
	ImmutableRecordAPI,
	Model,
	ModelValue,
	MutableModelAPI,
	MutableRecordAPI,
	QueryParams,
	RecordValue,
	RelationAPI,
	Resolve,
	TombstoneAPI,
} from "@canvas-js/modeldb-interface"
import { decodeRecord, encodeRecord } from "./encoding.js"
import { IDBPDatabase } from "idb"

export const getRecordTableName = (modelName: string) => `record/${modelName}`
export const getTombstoneTableName = (modelName: string) => `tombstone/${modelName}`
export const getRelationTableName = (modelName: string, propertyName: string) => `relation/${modelName}/${propertyName}`

export const getPropertyIndexName = (modelName: string, index: string[]) => `record/${modelName}/${index.join("/")}`

export const getRelationSourceIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/source`

export const getRelationTargetIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/target`

async function query(db: IDBPDatabase, queryParams: QueryParams, model: Model): Promise<ModelValue[]> {
	const recordTableName = getRecordTableName(model.name)

	const transaction = db.transaction(recordTableName, "readonly")
	const objectStore = transaction.objectStore(recordTableName)

	let records: RecordValue[]
	if (queryParams.where) {
		const where = queryParams.where

		const whereFields = Object.keys(where).sort()

		const indexName = getPropertyIndexName(model.name, whereFields)
		if (!objectStore.indexNames.contains(indexName)) {
			throw new Error(`Index ${indexName} does not exist`)
		}
		// only allow queries over fields that are already indexed
		const whereValues = whereFields.map((field) => where[field])

		const index = objectStore.index(indexName)
		// TODO: this doesn't accept null values, do we want to accept that?
		records = await index.getAll(whereValues as string[])
	} else {
		records = await objectStore.getAll()
	}

	const modelRecords = records.map((record) => decodeRecord(model, record)).filter((x) => x !== null) as RecordValue[]

	const orderBy = queryParams.orderBy
	if (orderBy) {
		if (Object.keys(orderBy).length !== 1) {
			throw new Error("orderBy must have exactly one field")
		}
		const orderByKey = Object.keys(orderBy)[0]
		if (!model.properties.find((property) => property.name === orderByKey)) {
			throw new Error(`orderBy field ${orderByKey} does not exist`)
		}

		modelRecords.sort((a, b) => {
			const aValue = a[orderByKey]
			const bValue = b[orderByKey]

			let result: number

			if (aValue === null && bValue === null) {
				result = 0
			} else if (aValue === null) {
				result = 1
			} else if (bValue === null) {
				result = -1
			} else {
				result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
			}

			return orderBy[orderByKey] === "asc" ? result : -result
		})
	}

	if (queryParams.select) {
		const select = queryParams.select

		if (Object.keys(select).length === 0) {
			throw new Error("select must have at least one field")
		}

		for (const column of Object.keys(select)) {
			if (!model.properties.find((property) => property.name === column)) {
				throw new Error(`select field '${column}' does not exist`)
			}
		}

		for (const record of modelRecords) {
			for (const field of Object.keys(record)) {
				if (!select[field]) {
					delete record[field]
				}
			}
		}
	}

	return modelRecords
}

function prepareTombstoneAPI(db: IDBPDatabase, model: Model): TombstoneAPI {
	const tombstoneTableName = getTombstoneTableName(model.name)

	return {
		select: async ({ _key }) => (await db.get(tombstoneTableName, _key)) || null,
		delete: async ({ _key }) => db.delete(tombstoneTableName, _key),
		insert: async ({ _key, _metadata, _version }) => {
			await db.put(tombstoneTableName, { _key, _metadata, _version }, _key)
		},
		update: async ({ _key, _metadata, _version }) => {
			await db.put(tombstoneTableName, { _key, _metadata, _version }, _key)
		},
	}
}

function prepareRelationAPI(db: IDBPDatabase, modelName: string, propertyName: string): RelationAPI {
	const tableName = getRelationTableName(modelName, propertyName)

	return {
		selectAll: async ({ _source }) => {
			const transaction = db.transaction(tableName, "readonly")
			const objectStore = transaction.objectStore(tableName)
			return await objectStore.index("_source").getAll(_source)
		},
		deleteAll: async ({ _source }) => {
			const transaction = db.transaction(tableName, "readwrite")
			const objectStore = transaction.objectStore(tableName)
			const relations = await objectStore.index("_source").getAll(_source)
			await Promise.all(relations.map((relation) => relation.delete()))
			await transaction.done
		},
		create: async ({ _source, _target }) => {
			await db.put(tableName, { _source, _target }, `${_source}/${_target}`)
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
		select: async ({ _key }) => {
			const record = await db.get(recordTableName, _key)
			return record ? decodeRecord(model, record) : null
		},
		iterate: async function* () {
			for (const value of await db.getAll(recordTableName)) {
				const decodedRecord = decodeRecord(model, value)
				if (decodedRecord) yield decodedRecord
			}
		},
		selectAll: async () => {
			const records = await db.getAll(recordTableName)
			return records.map((record) => decodeRecord(model, record)).filter((x) => x !== null) as RecordValue[]
		},
		insert: async ({ _key, _metadata, _version, value }) => {
			const record = encodeRecord(model, value)
			db.put(recordTableName, { _key, _metadata, _version, ...record }, _key)
		},
		update: async ({ _key, _metadata, _version, value }) => {
			const record = encodeRecord(model, value)
			db.put(recordTableName, { _key, _metadata, _version, ...record }, _key)
		},
		delete: async ({ _key }) => db.delete(recordTableName, _key),
		selectVersion: async ({ _key }) => {
			const record = await db.get(recordTableName, _key)
			const _version = record ? record._version : null
			return { _version }
		},
		query: async (queryParams) => query(db, queryParams, model),
	}
}

function prepareImmutableRecordAPI(db: IDBPDatabase, model: Model): ImmutableRecordAPI {
	const recordTableName = getRecordTableName(model.name)

	return {
		select: async ({ _key }) => {
			const record = await db.get(recordTableName, _key)
			return record ? decodeRecord(model, record) : null
		},
		iterate: async function* () {
			for (const value of await db.getAll(recordTableName)) {
				const decodedRecord = decodeRecord(model, value)
				if (decodedRecord) yield decodedRecord
			}
		},
		selectAll: async () => {
			const records = await db.getAll(recordTableName)
			return records.map((record) => decodeRecord(model, record)).filter((x) => x !== null) as RecordValue[]
		},
		insert: async ({ _key, _metadata, value }) => {
			const record = encodeRecord(model, value)
			await db.put(recordTableName, { _key, _metadata, ...record }, _key)
		},
		update: async ({ _key, _metadata, _version, value }) => {
			const record = encodeRecord(model, value)
			await db.put(recordTableName, { _key, _metadata, _version, ...record })
		},
		delete: async ({ _key }) => db.delete(recordTableName, _key),
		query: async (queryParams) => query(db, queryParams, model),
	}
}

export function createIdbMutableModelAPI(db: IDBPDatabase, model: Model, options: { resolve?: Resolve } = {}) {
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
