import * as sqlite from "better-sqlite3"

import {
	ImmutableModelAPI,
	ImmutableRecordAPI,
	Model,
	ModelValue,
	MutableModelAPI,
	MutableRecordAPI,
	RecordValue,
	RelationAPI,
	TombstoneAPI,
} from "@canvas-js/modeldb-interface"
import { getRecordTableName, getRelationTableName, getTombstoneTableName } from "./initialize.js"
import { Method, Query, iteratorToAsyncIterableIterator, signalInvalidType, zip } from "./utils.js"

// The code here is designed so the SQL queries have type annotations alongside them.
// Operations are organized into "APIs", one for each underlying SQLite table.
// An "API" is just a plain JavaScript object with `Query` and `Method` values.

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
		iterate: (args) => {
			const r = [...selectAll.iterate(args)]
			console.log(r)

			return iteratorToAsyncIterableIterator(selectAll.iterate(args))
		},
		iterateSync: (args) => selectAll.iterate(args),
		selectAll: async (args) => selectAll.all(args),
		select: async (args) => selectRecord.get(args),
		insert: async (args) => insertRecord.run(args),
		update: async (args) => updateRecord.run(args),
		delete: async (args) => deleteRecord.run(args),
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
		iterate: (args) => iteratorToAsyncIterableIterator(selectAll.iterate(args)),
		selectAll: async (args) => selectAll.all(args),
		select: async (args) => selectRecord.get(args),
		insert: async (args) => insertRecord.run(args),
		update: async (args) => updateRecord.run(args),
		delete: async (args) => deleteRecord.run(args),
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

export function createSqliteMutableModelAPI(
	db: sqlite.Database,
	model: Model,
	options: { resolve?: (a: string, b: string) => string } = {}
) {
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
