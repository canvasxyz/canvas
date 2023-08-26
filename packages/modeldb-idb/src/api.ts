import { Model, ModelValue, QueryParams, RecordValue, Resolve } from "@canvas-js/modeldb-interface"
import { decodeRecord, encodeRecord } from "./encoding.js"
import { IDBPTransaction } from "idb"

type IDBPTransactionReadWrite = IDBPTransaction<any, any, "readwrite">

export const getRecordTableName = (modelName: string) => `record/${modelName}`
export const getTombstoneTableName = (modelName: string) => `tombstone/${modelName}`
export const getRelationTableName = (modelName: string, propertyName: string) => `relation/${modelName}/${propertyName}`

export const getPropertyIndexName = (modelName: string, index: string[]) => `record/${modelName}/${index.join("/")}`

export const getRelationSourceIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/source`

export const getRelationTargetIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/target`

export async function query(
	transaction: IDBPTransactionReadWrite,
	queryParams: QueryParams,
	model: Model
): Promise<ModelValue[]> {
	const recordTableName = getRecordTableName(model.name)

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

function prepareTombstoneAPI(transaction: IDBPTransactionReadWrite, model: Model) {
	const tombstoneTableName = getTombstoneTableName(model.name)
	const store = transaction.objectStore(tombstoneTableName)

	return {
		select: async ({ _key }: { _key: string }) => (await store.get(_key)) || null,
		delete: async ({ _key }: { _key: string }) => store.delete(_key),
		insert: async ({ _key, _version }: { _key: string; _version: string }) => {
			await store.put({ _key, _version }, _key)
		},
		update: async ({ _key, _version }: { _key: string; _version: string }) => {
			await store.put({ _key, _version }, _key)
		},
	}
}

function prepareRelationAPI(transaction: IDBPTransactionReadWrite, modelName: string, propertyName: string) {
	const tableName = getRelationTableName(modelName, propertyName)
	const store = transaction.objectStore(tableName)

	return {
		selectAll: async ({ _source }: { _source: string }) => {
			return await store.index("_source").getAll(_source)
		},
		deleteAll: async ({ _source }: { _source: string }) => {
			const relations = await store.index("_source").getAll(_source)
			await Promise.all(relations.map((relation) => relation.delete()))
			await transaction.done
		},
		create: async ({ _source, _target }: { _source: string; _target: string }) => {
			await store.put({ _source, _target }, `${_source}/${_target}`)
		},
	}
}

function prepareRelationAPIs(transaction: IDBPTransactionReadWrite, model: Model) {
	const relations: Record<string, ReturnType<typeof prepareRelationAPI>> = {}
	for (const property of model.properties) {
		if (property.kind === "relation") {
			relations[property.name] = prepareRelationAPI(transaction, model.name, property.name)
		}
	}

	return relations
}

function prepareMutableRecordAPI(transaction: IDBPTransactionReadWrite, model: Model) {
	const recordTableName = getRecordTableName(model.name)
	const store = transaction.objectStore(recordTableName)

	return {
		select: async ({ _key }: { _key: string }) => {
			const record = await store.get(_key)
			return record ? decodeRecord(model, record) : null
		},
		iterate: async function* () {
			for (const value of await store.getAll()) {
				const decodedRecord = decodeRecord(model, value)
				if (decodedRecord) yield decodedRecord
			}
		},
		selectAll: async () => {
			const records = await store.getAll()
			return records.map((record) => decodeRecord(model, record)).filter((x) => x !== null) as RecordValue[]
		},
		insert: async ({ _key, _version, value }: { _key: string; _version: string | null; value: ModelValue }) => {
			const record = encodeRecord(model, value)

			store.put({ _key, _version, ...record }, _key)
		},
		update: async ({ _key, _version, value }: { _key: string; _version: string | null; value: ModelValue }) => {
			const record = encodeRecord(model, value)

			store.put({ _key, _version, ...record }, _key)
		},
		delete: async ({ _key }: { _key: string }) => store.delete(_key),
		selectVersion: async ({ _key }: { _key: string }) => {
			const record = await store.get(_key)
			const _version = record ? record._version : null
			return { _version }
		},
		query: async (queryParams: QueryParams) => query(transaction, queryParams, model),
		count: async () => store.count(),
	}
}

function prepareImmutableRecordAPI(transaction: IDBPTransactionReadWrite, model: Model) {
	const recordTableName = getRecordTableName(model.name)
	const store = transaction.objectStore(recordTableName)

	return {
		select: async ({ _key }: { _key: string }) => {
			const record = await store.get(_key)
			return record ? decodeRecord(model, record) : null
		},
		iterate: async function* () {
			for (const value of await store.getAll()) {
				const decodedRecord = decodeRecord(model, value)
				if (decodedRecord) yield decodedRecord
			}
		},
		selectAll: async () => {
			const records = await store.getAll()
			return records.map((record) => decodeRecord(model, record)).filter((x) => x !== null) as RecordValue[]
		},
		insert: async ({ _key, value }: { _key: string; value: ModelValue }) => {
			const record = encodeRecord(model, value)
			await store.put({ _key, ...record }, _key)
		},
		update: async ({ _key, _version, value }: { _key: string; _version: string | null; value: ModelValue }) => {
			const record = encodeRecord(model, value)
			await store.put({ _key, _version, ...record })
		},
		delete: async ({ _key }: { _key: string }) => store.delete(_key),
		query: async (queryParams: QueryParams) => query(transaction, queryParams, model),
		count: async () => store.count(),
	}
}

export function createIdbMutableModelDBContext(
	transaction: IDBPTransactionReadWrite,
	model: Model,
	resolve: Resolve | undefined
) {
	return {
		tombstones: prepareTombstoneAPI(transaction, model),
		relations: prepareRelationAPIs(transaction, model),
		records: prepareMutableRecordAPI(transaction, model),
		resolve: resolve,
		model,
	}
}

export function createIdbImmutableModelDBContext(transaction: IDBPTransaction<any, any, "readwrite">, model: Model) {
	return {
		relations: prepareRelationAPIs(transaction, model),
		records: prepareImmutableRecordAPI(transaction, model),
		model,
	}
}
