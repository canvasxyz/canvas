import * as sqlite from "better-sqlite3"

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
import { getRecordTableName, getRelationTableName, getTombstoneTableName } from "./initialize.js"
import { decodeRecord, encodeRecordParams } from "./encoding.js"
import { Method, Query, signalInvalidType, zip } from "./utils.js"

// The code here is designed so the SQL queries have type annotations alongside them.
// Operations are organized into "APIs", one for each underlying SQLite table.
// An "API" is just a plain JavaScript object with `Query` and `Method` values.

async function query(db: sqlite.Database, queryParams: QueryParams, model: Model): Promise<ModelValue[]> {
	const recordTableName = getRecordTableName(model.name)

	// SELECT

	let columnNames: string[] = []

	if (queryParams.select) {
		if (Object.keys(queryParams.select).length > 0) {
			columnNames = Object.keys(queryParams.select)

			for (const column of Object.keys(queryParams.select)) {
				if (!model.properties.find((property) => property.name === column)) {
					throw new Error(`select field '${column}' does not exist`)
				}
			}
		} else {
			throw new Error("select must have at least one field")
		}
	}

	const columnsToSelect: string[] =
		columnNames.length === 0 ? model.properties.map((property) => property.name) : columnNames

	const columnNamesSelector = columnsToSelect.join(", ")

	let queryString = `SELECT ${columnNamesSelector} FROM "${recordTableName}"`
	const queryParamsList = []

	// WHERE

	if (queryParams.where && Object.keys(queryParams.where).length > 0) {
		const where = queryParams.where
		const whereFields = Object.keys(where).sort()
		const whereValues = whereFields.map((field) => where[field])
		const whereClause = whereFields.map((field) => `${field} = ?`).join(" AND ")

		queryString += ` WHERE ${whereClause}`
		queryParamsList.push(...whereValues)
	}

	// ORDER BY
	if (queryParams.orderBy) {
		if (Object.keys(queryParams.orderBy).length !== 1) {
			throw new Error("orderBy must have exactly one field")
		}
		const orderByKey = Object.keys(queryParams.orderBy)[0]
		const orderByValue = queryParams.orderBy[orderByKey]
		if (orderByValue !== "asc" && orderByValue !== "desc") {
			throw new Error("orderBy must be either 'asc' or 'desc'")
		}
		queryString += ` ORDER BY ${orderByKey} ${orderByValue.toUpperCase()}`
	}

	const records = db.prepare(queryString).all(queryParamsList) as RecordValue[]

	// only call decodeRecord on the selected columns
	const selectedModel = {
		...model,
		properties:
			columnNames.length > 0
				? model.properties.filter((property) => columnNames.includes(property.name))
				: model.properties,
	}

	return records.map((record) => decodeRecord(selectedModel, record)).filter((x) => x !== null)
}

function prepareTombstoneAPI(db: sqlite.Database, model: Model): TombstoneAPI {
	const tombstoneTableName = getTombstoneTableName(model.name)

	const selectTombstone = new Query<{ _key: string }, { _metadata: string | null; _version: string }>(
		db,
		`SELECT _metadata, _version FROM "${tombstoneTableName}" WHERE _key = :_key`
	)

	const deleteTombstone = new Method<{ _key: string }>(db, `DELETE FROM "${tombstoneTableName}" WHERE _key = :_key`)

	const insertTombstone = new Method<{ _key: string; _metadata: string | null; _version: string }>(
		db,
		`INSERT INTO "${tombstoneTableName}" (_key, _metadata, _version) VALUES (:_key, :_metadata, :_version)`
	)

	const updateTombstone = new Method<{ _key: string; _metadata: string | null; _version: string }>(
		db,
		`UPDATE "${tombstoneTableName}" SET _metadata = :_metadata, _version = :_version WHERE _key = :_key`
	)

	return {
		select: async (args) => selectTombstone.get(args),
		delete: async (args) => deleteTombstone.run(args),
		insert: async (args) => insertTombstone.run(args),
		update: async (args) => updateTombstone.run(args),
	}
}

function prepareMutableRecordAPI(db: sqlite.Database, model: Model): MutableRecordAPI {
	const recordTableName = getRecordTableName(model.name)

	const selectVersion = new Query<{ _key: string }, { _version: string | null }>(
		db,
		`SELECT _version FROM  "${recordTableName}" WHERE _key = :_key`
	)

	// in SQLite, query params can't have quoted names, so we name them
	// p0, p1, p2... using the index of the model.properties array.

	const params: Record<string, string> = {} // maps property names to query parameter names
	const columnNames: `"${string}"`[] = [] // quoted column names for non-relation properties
	const columnParams: `:p${string}`[] = [] // query params for non-relation properties

	for (const [i, property] of model.properties.entries()) {
		if (property.kind === "primitive" || property.kind === "reference") {
			params[property.name] = `p${i}`
			columnParams.push(`:p${i}`)
			columnNames.push(`"${property.name}"`)
		} else if (property.kind === "relation") {
			continue
		} else {
			signalInvalidType(property)
		}
	}

	const selectAll = new Query<{}, RecordValue>(db, `SELECT ${columnNames.join(", ")} FROM "${recordTableName}"`)

	const selectRecord = new Query<{ _key: string }, RecordValue>(
		db,
		`SELECT ${columnNames.join(", ")} FROM "${recordTableName}" WHERE _key = :_key`
	)

	const insertRecordParams = `_key, _metadata, _version, ${columnNames.join(", ")}`
	const insertRecordValues = `:_key, :_metadata, :_version, ${columnParams.join(", ")}`
	const insertRecord = new Method<{ _key: string; _version: string | null; _metadata: string | null } & ModelValue>(
		db,
		`INSERT INTO "${recordTableName}" (${insertRecordParams}) VALUES (${insertRecordValues})`
	)

	const updateRecordProperties = zip(columnNames, columnParams).map(([name, param]) => `${name} = ${param}`)
	const updateRecordEntries = `_metadata = :_metadata, _version = :_version, ${updateRecordProperties.join(", ")}`
	const updateRecord = new Method<{ _key: string; _version: string | null; _metadata: string | null } & ModelValue>(
		db,
		`UPDATE "${recordTableName}" SET ${updateRecordEntries} WHERE _key = :_key`
	)

	const deleteRecord = new Method<{ _key: string }>(db, `DELETE FROM "${recordTableName}" WHERE _key = :_key`)

	// @ts-ignore
	return {
		params,
		selectVersion: async (args) => selectVersion.get(args),
		iterate: async function* (args) {
			for (let record of selectAll.iterate(args)) {
				yield decodeRecord(model, record)
			}
		},
		selectAll: async (args) => selectAll.all(args).map((record) => decodeRecord(model, record)),
		select: async (args) => {
			const record = selectRecord.get(args)
			return record === null ? null : decodeRecord(model, record)
		},
		insert: async (args) => {
			const encodedParams = encodeRecordParams(model, args.value, params || {})
			insertRecord.run({ _key: args._key, _metadata: args._metadata, _version: args._version, ...encodedParams })
		},
		update: async (args) => {
			const encodedParams = encodeRecordParams(model, args.value, params || {})
			updateRecord.run({ _key: args._key, _metadata: args._metadata, _version: args._version, ...encodedParams })
		},
		delete: async (args) => deleteRecord.run(args),
		query: async (queryParams) => query(db, queryParams, model),
	}
}

function prepareImmutableRecordAPI(db: sqlite.Database, model: Model): ImmutableRecordAPI {
	const recordTableName = getRecordTableName(model.name)

	const params: Record<string, string> = {}
	const columnNames: `"${string}"`[] = [] // quoted column names for non-relation properties
	const columnParams: `:${string}`[] = [] // query params for non-relation properties

	for (const [i, property] of model.properties.entries()) {
		if (property.kind === "primitive" || property.kind === "reference") {
			params[property.name] = `p${i}`
			columnParams.push(`:p${i}`)
			columnNames.push(`"${property.name}"`)
		} else if (property.kind === "relation") {
			continue
		} else {
			signalInvalidType(property)
		}
	}

	if (columnNames.length === 0) {
		throw new Error(`Model "${model.name}" has no columns`)
	}

	const selectAll = new Query<{}, RecordValue>(db, `SELECT ${columnNames.join(", ")} FROM "${recordTableName}"`)

	const selectRecord = new Query<{ _key: string }, RecordValue | null>(
		db,
		`SELECT ${columnNames.join(", ")} FROM "${recordTableName}" WHERE _key = :_key`
	)

	const insertRecordParams = `_key, _metadata, ${columnNames.join(", ")}`
	const insertRecordValues = `:_key, :_metadata, ${columnParams.join(", ")}`
	const insertRecord = new Method<{ _key: string; _metadata: string | null } & RecordValue>(
		db,
		`INSERT OR IGNORE INTO "${recordTableName}" (${insertRecordParams}) VALUES (${insertRecordValues})`
	)

	const updateRecordProperties = zip(columnNames, columnParams).map(([name, param]) => `${name} = ${param}`)
	const updateRecordEntries = `_metadata = :_metadata, ${updateRecordProperties.join(", ")}`
	const updateRecord = new Method<{ _key: string; _version: string | null; _metadata: string | null } & RecordValue>(
		db,
		`UPDATE "${recordTableName}" SET ${updateRecordEntries} WHERE _key = :_key`
	)

	const deleteRecord = new Method<{ _key: string }>(db, `DELETE FROM "${recordTableName}" WHERE _key = :_key`)

	return {
		params,
		iterate: async function* (args) {
			for (let record of selectAll.iterate(args)) {
				yield decodeRecord(model, record)
			}
		},
		selectAll: async (args) => selectAll.all(args).map((record) => decodeRecord(model, record)),
		select: async (args) => {
			const record = selectRecord.get(args)
			return record === null ? null : decodeRecord(model, record)
		},
		insert: async (args) => {
			const encodedParams = encodeRecordParams(model, args.value, params || {})
			insertRecord.run({ _key: args._key, _metadata: args._metadata, ...encodedParams })
		},
		update: async (args) => {
			const encodedParams = encodeRecordParams(model, args.value, params || {})
			updateRecord.run({ _key: args._key, _metadata: args._metadata, _version: args._version, ...encodedParams })
		},
		delete: async (args) => deleteRecord.run(args),
		query: async (queryParams) => query(db, queryParams, model),
	}
}

function prepareRelationAPI(db: sqlite.Database, modelName: string, propertyName: string): RelationAPI {
	const tableName = getRelationTableName(modelName, propertyName)

	const selectAll = new Query<{ _source: string }, { _target: string }>(
		db,
		`SELECT _target FROM "${tableName}" WHERE _source = :_source`
	)

	const deleteAll = new Method<{ _source: string }>(db, `DELETE FROM "${tableName}" WHERE _source = :_source`)

	const create = new Method<{ _source: string; _target: string }>(
		db,
		`INSERT INTO "${tableName}" (_source, _target) VALUES (:_source, :_target)`
	)

	return {
		selectAll: async (args) => selectAll.all(args),
		deleteAll: async (args) => deleteAll.run(args),
		create: async (args) => create.run(args),
	}
}

function prepareRelationAPIs(db: sqlite.Database, model: Model) {
	const relations: Record<string, RelationAPI> = {}
	for (const property of model.properties) {
		if (property.kind === "relation") {
			relations[property.name] = prepareRelationAPI(db, model.name, property.name)
		}
	}

	return relations
}

export function createSqliteMutableModelAPI(db: sqlite.Database, model: Model, options: { resolve?: Resolve } = {}) {
	const tombstoneAPI = prepareTombstoneAPI(db, model)
	const relations = prepareRelationAPIs(db, model)
	const records = prepareMutableRecordAPI(db, model)
	return new MutableModelAPI(tombstoneAPI, relations, records, model, options)
}

export function createSqliteImmutableModelAPI(db: sqlite.Database, model: Model, options: { dkLen?: number } = {}) {
	const relationAPIs = prepareRelationAPIs(db, model)
	const immutableRecordAPI = prepareImmutableRecordAPI(db, model)

	return new ImmutableModelAPI(relationAPIs, immutableRecordAPI, model, options)
}
