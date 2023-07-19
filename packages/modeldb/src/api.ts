import assert from "node:assert"

import * as sqlite from "better-sqlite3"

import { Model, ModelValue, PrimitiveProperty, PropertyValue, ReferenceProperty } from "./types.js"
import { getRecordTableName, getRelationTableName, getTombstoneTableName } from "./intialize.js"
import { DEFAULT_DIGEST_LENGTH, Method, Query, getRecordHash, signalInvalidType, zip } from "./utils.js"

// The code here is designed so the SQL queries have type annotations alongside them.
// Operations are organized into "APIs", one for each underlying SQLite table.
// An "API" is just a plain JavaScript object with `Query` and `Method` values.

type RecordValue = Record<string, string | number | Buffer | null>

function prepareTombstoneAPI(db: sqlite.Database, model: Model) {
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

	return { select: selectTombstone, delete: deleteTombstone, insert: insertTombstone, update: updateTombstone }
}

function prepareMutableRecordAPI(db: sqlite.Database, model: Model) {
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

	return {
		params,
		selectVersion,
		selectAll,
		select: selectRecord,
		insert: insertRecord,
		update: updateRecord,
		delete: deleteRecord,
	}
}

function prepareImmutableRecordAPI(db: sqlite.Database, model: Model) {
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
		selectAll,
		select: selectRecord,
		insert: insertRecord,
		update: updateRecord,
		delete: deleteRecord,
	}
}

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

	return { selectAll, deleteAll, create }
}

function encodePrimitiveValue(
	modelName: string,
	property: PrimitiveProperty,
	value: PropertyValue
): string | number | Buffer | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be an integer`)
		}
	} else if (property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a number`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a string`)
		}
	} else if (property.type === "bytes") {
		if (value instanceof Uint8Array) {
			return Buffer.isBuffer(value) ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else {
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

function decodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: string | number | Buffer | null) {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new Error(`internal error - missing ${modelName}/${property.name} value`)
		}
	}

	if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value
		} else {
			console.error("expected integer, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected integer)`)
		}
	} else if (property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			console.error("expected float, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected float)`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			console.error("expected string, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
		}
	} else if (property.type === "bytes") {
		if (Buffer.isBuffer(value)) {
			return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		} else {
			console.error("expected Uint8Array, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected Uint8Array)`)
		}
	} else {
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

function encodeReferenceValue(modelName: string, property: ReferenceProperty, value: PropertyValue): string | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (typeof value === "string") {
		return value
	} else {
		throw new TypeError(`${modelName}/${property.name} must be a string`)
	}
}

function decodeReferenceValue(
	modelName: string,
	property: ReferenceProperty,
	value: string | number | Uint8Array | null
): string | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`internal error - missing ${modelName}/${property.name} value`)
		}
	} else if (typeof value === "string") {
		return value
	} else {
		throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
	}
}

function encodeRecordParams(model: Model, value: ModelValue, params: Record<string, string>): RecordValue {
	const record: RecordValue = {}

	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`missing value for property ${model.name}/${property.name}`)
		}

		const param = params[property.name]
		if (property.kind === "primitive") {
			record[param] = encodePrimitiveValue(model.name, property, value[property.name])
		} else if (property.kind === "reference") {
			record[param] = encodeReferenceValue(model.name, property, value[property.name])
		} else {
			assert(Array.isArray(value[property.name]))
			continue
		}
	}

	return record
}

function decodeRecord(model: Model, record: RecordValue): ModelValue {
	const value: ModelValue = {}

	for (const property of model.properties) {
		if (property.kind === "primitive") {
			value[property.name] = decodePrimitiveValue(model.name, property, record[property.name])
		} else if (property.kind === "reference") {
			value[property.name] = decodeReferenceValue(model.name, property, record[property.name])
		} else if (property.kind === "relation") {
			continue
		} else {
			signalInvalidType(property)
		}
	}

	return value
}

class BaseModelAPI {
	readonly #relations: Record<string, ReturnType<typeof prepareRelationAPI>> = {}
	constructor(public readonly db: sqlite.Database, public readonly model: Model) {
		for (const property of model.properties) {
			if (property.kind === "relation") {
				this.#relations[property.name] = prepareRelationAPI(db, model.name, property.name)
			}
		}
	}
}

export class MutableModelAPI {
	readonly #tombstones: ReturnType<typeof prepareTombstoneAPI>
	readonly #relations: Record<string, ReturnType<typeof prepareRelationAPI>> = {}
	readonly #records: ReturnType<typeof prepareMutableRecordAPI>

	readonly #resolve?: (a: string, b: string) => string

	constructor(
		public readonly db: sqlite.Database,
		public readonly model: Model,
		options: { resolve?: (a: string, b: string) => string } = {}
	) {
		assert(model.kind === "mutable")
		this.#resolve = options.resolve
		this.#tombstones = prepareTombstoneAPI(db, model)
		this.#records = prepareMutableRecordAPI(db, model)
		for (const property of model.properties) {
			if (property.kind === "relation") {
				this.#relations[property.name] = prepareRelationAPI(db, model.name, property.name)
			}
		}
	}

	public get(key: string): ModelValue | null {
		const record = this.#records.select.get({ _key: key })
		if (record === null) {
			return null
		}

		const value = decodeRecord(this.model, record)

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			value[propertyName] = relation.selectAll.all({ _source: key }).map(({ _target }) => _target)
		}

		return value
	}

	public set(key: string, value: ModelValue, options: { version?: string | null; metadata?: string | null } = {}) {
		let version: string | null = null
		let metadata: string | null = null

		const existingVersion = this.#records.selectVersion.get({ _key: key })
		const existingTombstone = this.#tombstones.select.get({ _key: key })

		// if conflict resolution is enable
		if (this.#resolve !== undefined) {
			version = options.version ?? null
			metadata = options.metadata ?? null

			// no-op if an existing record takes precedence
			if (existingVersion !== null && existingVersion._version !== null) {
				if (version === null) {
					return
				} else if (this.#resolve(existingVersion._version, version) === existingVersion._version) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (existingTombstone !== null && existingTombstone._version !== null) {
				if (version === null) {
					return
				} else if (this.#resolve(existingTombstone._version, version) === existingTombstone._version) {
					return
				}
			}
		}

		if (existingTombstone !== null) {
			// delete the tombstone since we're about to set the record
			this.#tombstones.delete.run({ _key: key })
		}

		const params = encodeRecordParams(this.model, value, this.#records.params)

		if (existingVersion === null) {
			this.#records.insert.run({ _key: key, _version: version, _metadata: metadata, ...params })
		} else {
			this.#records.update.run({ _key: key, _version: version, _metadata: metadata, ...params })
			for (const relation of Object.values(this.#relations)) {
				relation.deleteAll.run({ _source: key })
			}
		}

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			const targets = value[propertyName]

			if (!Array.isArray(targets)) {
				throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
			}

			for (const target of targets) {
				if (typeof target !== "string") {
					throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
				}

				relation.create.run({ _source: key, _target: target })
			}
		}
	}

	public delete(key: string, options: { version?: string | null; metadata?: string | null } = {}) {
		let version: string | null = null
		let metadata: string | null = null

		const previous = this.#records.selectVersion.get({ _key: key })
		const tombstone = this.#tombstones.select.get({ _key: key })

		// if conflict resolution is enable
		if (this.#resolve !== undefined) {
			version = options.version ?? null
			metadata = options.metadata ?? null

			// no-op if an existing record takes precedence
			if (previous !== null && previous._version !== null) {
				if (version === null || this.#resolve(previous._version, version) === previous._version) {
					return
				}
			}

			// no-op if an existing tombstone takes precedence
			if (tombstone !== null && tombstone._version !== null) {
				if (version === null || this.#resolve(tombstone._version, version) === tombstone._version) {
					return
				}
			}
		}

		this.#records.delete.run({ _key: key })
		for (const relation of Object.values(this.#relations)) {
			relation.deleteAll.run({ _source: key })
		}

		if (this.#resolve !== undefined && version !== null) {
			if (tombstone === null) {
				this.#tombstones.insert.run({ _key: key, _metadata: metadata, _version: version })
			} else {
				this.#tombstones.update.run({ _key: key, _metadata: metadata, _version: version })
			}
		}
	}

	public async *iterate(): AsyncIterable<ModelValue> {
		yield* this.#records.selectAll.iterate({})
	}
}

export class ImmutableModelAPI {
	readonly #relations: Record<string, ReturnType<typeof prepareRelationAPI>> = {}
	readonly #records: ReturnType<typeof prepareImmutableRecordAPI>
	readonly #dkLen: number

	constructor(public readonly db: sqlite.Database, public readonly model: Model, options: { dkLen?: number } = {}) {
		assert(model.kind === "immutable")
		this.#dkLen = options.dkLen ?? DEFAULT_DIGEST_LENGTH
		this.#records = prepareImmutableRecordAPI(db, model)
		for (const property of model.properties) {
			if (property.kind === "relation") {
				this.#relations[property.name] = prepareRelationAPI(db, model.name, property.name)
			}
		}
	}

	public add(value: ModelValue, { namespace, metadata }: { namespace?: string; metadata?: string } = {}): string {
		const recordHash = getRecordHash(value, this.#dkLen)
		const key = namespace ? `${namespace}/${recordHash}` : recordHash
		const existingRecord = this.#records.select.get({ _key: key })
		if (existingRecord === null) {
			const params = encodeRecordParams(this.model, value, this.#records.params)
			this.#records.insert.run({ _key: key, _metadata: metadata ?? null, ...params })

			for (const [propertyName, relation] of Object.entries(this.#relations)) {
				const targets = value[propertyName]

				if (!Array.isArray(targets)) {
					throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
				}

				for (const target of targets) {
					if (typeof target !== "string") {
						throw new TypeError(`${this.model.name}/${propertyName} must be string[]`)
					}

					relation.create.run({ _source: key, _target: target })
				}
			}
		}

		return key
	}

	public remove(key: string) {
		const existingRecord = this.#records.select.get({ _key: key })
		if (existingRecord !== null) {
			this.#records.delete.run({ _key: key })
			for (const relation of Object.values(this.#relations)) {
				relation.deleteAll.run({ _source: key })
			}
		}
	}

	public get(key: string): ModelValue | null {
		const record = this.#records.select.get({ _key: key })
		if (record === null) {
			return null
		}

		const value = decodeRecord(this.model, record)

		for (const [propertyName, relation] of Object.entries(this.#relations)) {
			value[propertyName] = relation.selectAll.all({ _source: key }).map(({ _target }) => _target)
		}

		return value
	}

	public async *iterate(): AsyncIterable<ModelValue> {
		yield* this.#records.selectAll.iterate({})
	}
}
