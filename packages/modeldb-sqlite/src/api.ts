import * as sqlite from "better-sqlite3"

import {
	Model,
	ModelValue,
	QueryParams,
	RecordValue,
	Resolver,
	getImmutableRecordKey,
} from "@canvas-js/modeldb-interface"

import { getRecordTableName, getRelationTableName, getTombstoneTableName } from "./initialize.js"
import { decodeRecord, encodeRecordParams } from "./encoding.js"
import { Method, Query, assert, signalInvalidType, zip } from "./utils.js"

// The code here is designed so the SQL queries have type annotations alongside them.
// Operations are organized into "APIs", one for each underlying SQLite table.
// An "API" is just a plain JavaScript object with `Query` and `Method` values.

function query(db: sqlite.Database, queryParams: QueryParams, model: Model): ModelValue[] {
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

function prepareTombstoneAPI(db: sqlite.Database, model: Model) {
	const tombstoneTableName = getTombstoneTableName(model.name)

	const selectTombstone = new Query<{ _key: string }, { _version: string }>(
		db,
		`SELECT  _version FROM "${tombstoneTableName}" WHERE _key = :_key`
	)

	const deleteTombstone = new Method<{ _key: string }>(db, `DELETE FROM "${tombstoneTableName}" WHERE _key = :_key`)

	const insertTombstone = new Method<{ _key: string; _version: string }>(
		db,
		`INSERT INTO "${tombstoneTableName}" (_key, _version) VALUES (:_key, :_version)`
	)

	const updateTombstone = new Method<{ _key: string; _version: string }>(
		db,
		`UPDATE "${tombstoneTableName}" SET _version = :_version WHERE _key = :_key`
	)

	return {
		select: (key: string) => selectTombstone.get({ _key: key }),
		delete: (key: string) => deleteTombstone.run({ _key: key }),
		insert: (key: string, version: string) => insertTombstone.run({ _key: key, _version: version }),
		update: (key: string, version: string) => updateTombstone.run({ _key: key, _version: version }),
	}
}

export function prepareMutableModelAPI(db: sqlite.Database, model: Model, resolver: Resolver) {
	const tombstones = prepareTombstoneAPI(db, model)
	const relations = prepareRelationAPIs(db, model)

	const recordTableName = getRecordTableName(model.name)

	const selectVersion = new Query<{ _key: string }, { _version: string }>(
		db,
		`SELECT _version FROM  "${recordTableName}" WHERE _key = :_key`
	)

	// in SQLite, query params can't have quoted names, so we name them
	// p0, p1, p2... using the index of the model.properties array.

	const paramsMap: Record<string, string> = {} // maps property names to query parameter names
	const columnNames: `"${string}"`[] = [] // quoted column names for non-relation properties
	const columnParams: `:p${string}`[] = [] // query params for non-relation properties

	for (const [i, property] of model.properties.entries()) {
		if (property.kind === "primitive" || property.kind === "reference") {
			paramsMap[property.name] = `p${i}`
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

	const insertRecordParams = `_key, _version, ${columnNames.join(", ")}`
	const insertRecordValues = `:_key, :_version, ${columnParams.join(", ")}`
	const insertRecord = new Method<{ _key: string; _version: string } & ModelValue>(
		db,
		`INSERT INTO "${recordTableName}" (${insertRecordParams}) VALUES (${insertRecordValues})`
	)

	const updateRecordProperties = zip(columnNames, columnParams).map(([name, param]) => `${name} = ${param}`)
	const updateRecordEntries = `_version = :_version, ${updateRecordProperties.join(", ")}`
	const updateRecord = new Method<{ _key: string; _version: string } & ModelValue>(
		db,
		`UPDATE "${recordTableName}" SET ${updateRecordEntries} WHERE _key = :_key`
	)

	const deleteRecord = new Method<{ _key: string }>(db, `DELETE FROM "${recordTableName}" WHERE _key = :_key`)
	const countRecords = new Query<{}, { count: number }>(db, `SELECT COUNT(*) AS count FROM "${recordTableName}"`)

	return {
		get: (key: string) => {
			const record = selectRecord.get({ _key: key })
			return record === null ? null : decodeRecord(model, record)
		},

		set: (key: string, value: ModelValue, version: string) => {
			// no-op if an existing record takes precedence
			const { _version: existingVersion = null } = selectVersion.get({ _key: key }) ?? {}
			if (existingVersion !== null && resolver.lessThan({ version }, { version: existingVersion })) {
				return
			}

			// no-op if an existing tombstone takes precedence
			const { _version: existingTombstone = null } = tombstones.select(key) ?? {}
			if (existingTombstone !== null && resolver.lessThan({ version }, { version: existingTombstone })) {
				return
			}

			// delete the tombstone since we're about to set the record
			if (existingTombstone !== null) {
				tombstones.delete(key)
			}

			const encodedParams = encodeRecordParams(model, value, paramsMap)
			if (existingVersion === null) {
				insertRecord.run({ _key: key, _version: version, ...encodedParams })
			} else {
				updateRecord.run({ _key: key, _version: version, ...encodedParams })
				for (const relation of Object.values(relations)) {
					relation.deleteAll({ _source: key })
				}
			}

			for (const [property, relation] of Object.entries(relations)) {
				const targets = value[property]
				assert(Array.isArray(targets), "expected string[]")
				for (const target of targets) {
					assert(typeof target === "string", "expected string")
					relation.create({ _source: key, _target: target })
				}
			}
		},

		delete: (key: string, version: string) => {
			// no-op if an existing record takes precedence
			const { _version: existingVersion = null } = selectVersion.get({ _key: key }) ?? {}
			if (existingVersion !== null && resolver.lessThan({ version }, { version: existingVersion })) {
				return
			}

			// no-op if an existing tombstone takes precedence
			const { _version: existingTombstone = null } = tombstones.select(key) ?? {}
			if (existingTombstone !== null && resolver.lessThan({ version }, { version: existingTombstone })) {
				return
			}

			deleteRecord.run({ _key: key })
			for (const relation of Object.values(relations)) {
				relation.deleteAll({ _source: key })
			}
		},

		version: (key: string) => {
			const { _version: version } = selectVersion.get({ _key: key }) ?? {}
			return version ?? null
		},

		iterate: function* () {
			for (const record of selectAll.iterate({})) {
				yield decodeRecord(model, record)
			}
		},

		count: () => countRecords.get({})?.count ?? 0,

		query: async (queryParams: QueryParams) => query(db, queryParams, model),
	}
}

export function prepareImmutableModelAPI(db: sqlite.Database, model: Model) {
	const relations = prepareRelationAPIs(db, model)
	const recordTableName = getRecordTableName(model.name)

	const paramsMap: Record<string, string> = {}
	const columnNames: `"${string}"`[] = [] // quoted column names for non-relation properties
	const columnParams: `:${string}`[] = [] // query params for non-relation properties

	for (const [i, property] of model.properties.entries()) {
		if (property.kind === "primitive" || property.kind === "reference") {
			paramsMap[property.name] = `p${i}`
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

	const insertRecordParams = `_key, ${columnNames.join(", ")}`
	const insertRecordValues = `:_key, ${columnParams.join(", ")}`
	const insertRecord = new Method<{ _key: string } & RecordValue>(
		db,
		`INSERT OR IGNORE INTO "${recordTableName}" (${insertRecordParams}) VALUES (${insertRecordValues})`
	)

	const deleteRecord = new Method<{ _key: string }>(db, `DELETE FROM "${recordTableName}" WHERE _key = :_key`)

	const countRecords = new Query<{}, { count: number }>(db, `SELECT COUNT(*) AS count FROM "${recordTableName}"`)

	return {
		get: (key: string) => {
			const record = selectRecord.get({ _key: key })
			return record === null ? null : decodeRecord(model, record)
		},

		add: (value: ModelValue): string => {
			const key = getImmutableRecordKey(value)
			const record = selectRecord.get({ _key: key })
			if (record !== null) {
				return key
			}

			const encodedParams = encodeRecordParams(model, value, paramsMap)
			insertRecord.run({ _key: key, ...encodedParams })
			for (const [property, relation] of Object.entries(relations)) {
				const targets = value[property]
				assert(Array.isArray(targets), "expected string[]")
				for (const target of targets) {
					assert(typeof target === "string", "expected string")
					relation.create({ _source: key, _target: target })
				}
			}

			return key
		},

		remove: (key: string) => {
			const record = selectRecord.get({ _key: key })
			if (record === null) {
				return
			}

			for (const relation of Object.values(relations)) {
				relation.deleteAll({ _source: key })
			}

			deleteRecord.run({ _key: key })
		},

		iterate: function* () {
			for (const record of selectAll.iterate({})) {
				yield decodeRecord(model, record)
			}
		},

		query: (queryParams: QueryParams) => query(db, queryParams, model),

		count: () => countRecords.get({})?.count ?? 0,
	}
}

// Relation API: { selectAll, deleteAll, creater }

function prepareRelationAPI(db: sqlite.Database, modelName: string, propertyName: string) {
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
		selectAll: async (args: { _source: string }) => selectAll.all(args),
		deleteAll: async (args: { _source: string }) => deleteAll.run(args),
		create: async (args: { _source: string; _target: string }) => create.run(args),
	}
}

function prepareRelationAPIs(db: sqlite.Database, model: Model) {
	const relations: Record<string, ReturnType<typeof prepareRelationAPI>> = {}
	for (const property of model.properties) {
		if (property.kind === "relation") {
			relations[property.name] = prepareRelationAPI(db, model.name, property.name)
		}
	}

	return relations
}
