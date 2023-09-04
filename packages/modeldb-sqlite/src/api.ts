import { Database } from "better-sqlite3"

import {
	Property,
	Relation,
	Model,
	ModelValue,
	PropertyValue,
	Resolver,
	PrimitiveType,
	Context,
} from "@canvas-js/modeldb-interface"

import { decodeRecord, encodeRecordParams } from "./encoding.js"
import { Method, Query, assert, mapValues, signalInvalidType, zip } from "./utils.js"

type RecordValue = Record<string, string | number | Buffer | null>
type Params = Record<`p${string}`, string | number | Buffer | null>

export const getRecordTableName = (model: string) => `record/${model}`
export const getTombstoneTableName = (model: string) => `tombstone/${model}`
export const getRelationTableName = (model: string, property: string) => `relation/${model}/${property}`
export const getPropertyIndexName = (model: string, index: string[]) => `record/${model}/${index.join("/")}`
export const getRelationSourceIndexName = (model: string, property: string) => `relation/${model}/${property}/source`
export const getRelationTargetIndexName = (model: string, property: string) => `relation/${model}/${property}/target`

const primitiveColumnTypes = {
	integer: "INTEGER",
	float: "FLOAT",
	string: "TEXT",
	bytes: "BLOB",
} satisfies Record<PrimitiveType, string>

function getPropertyColumnType(property: Property): string {
	if (property.kind === "primitive") {
		const type = primitiveColumnTypes[property.type]
		return property.optional ? type : `${type} NOT NULL`
	} else if (property.kind === "reference") {
		return property.optional ? "TEXT" : "TEXT NOT NULL"
	} else if (property.kind === "relation") {
		throw new Error("internal error - relation properties don't map to columns")
	} else {
		signalInvalidType(property)
	}
}

const getPropertyColumn = (property: Property) => `'${property.name}' ${getPropertyColumnType(property)}`

export class ModelAPI {
	#table = getRecordTableName(this.model.name)
	#params: Record<string, `p${string}`> = {}

	// Methods
	#insert: Method<{ _key: string; _version: Uint8Array | null } & Params>
	#update: Method<{ _key: string; _version: Uint8Array | null } & RecordValue>
	#delete: Method<{ _key: string }>

	// Queries
	#selectAll: Query<{}, { _key: string; _version: Uint8Array | null } & RecordValue>
	#select: Query<{ _key: string }, { _key: string; _version: Uint8Array | null } & RecordValue>
	#count: Query<{}, { count: number }>

	// Tombstone API
	#tombstones = new TombstoneAPI(this.db, this.model)

	readonly #relations: Record<string, RelationAPI> = {}

	public constructor(readonly db: Database, readonly model: Model, readonly resolver: Resolver) {
		const columns = [`_key TEXT PRIMARY KEY NOT NULL`, `_version BLOB`]
		const columnNames: `"${string}"`[] = [] // quoted column names for non-relation properties
		const columnParams: `:p${string}`[] = [] // query params for non-relation properties
		for (const [i, property] of model.properties.entries()) {
			if (property.kind === "primitive" || property.kind === "reference") {
				columns.push(getPropertyColumn(property))
				columnNames.push(`"${property.name}"`)
				columnParams.push(`:p${i}`)
				this.#params[property.name] = `p${i}`
			} else if (property.kind === "relation") {
				this.#relations[property.name] = new RelationAPI(db, {
					source: model.name,
					property: property.name,
					target: property.target,
					indexed: false,
				})
			} else {
				signalInvalidType(property)
			}
		}

		// Create record table
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${columns.join(", ")})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = getPropertyIndexName(model.name, index)
			const indexColumns = index.map((name) => `'${name}'`)
			db.exec(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.#table}" (${indexColumns.join(", ")})`)
		}

		// Prepare methods
		const insertNames = ["_key", "_version", ...columnNames].join(", ")
		const insertParams = [":_key", ":_version", ...columnParams].join(", ")
		this.#insert = new Method<{ _key: string } & Params>(
			db,
			`INSERT OR IGNORE INTO "${this.#table}" (${insertNames}) VALUES (${insertParams})`
		)

		const updateEntries = zip(["_version", ...columnNames], [":_version", ...columnParams])
			.map(([name, param]) => `${name} = ${param}`)
			.join(", ")

		this.#update = new Method<{ _key: string; _version: Uint8Array | null } & Params>(
			db,
			`UPDATE "${this.#table}" SET _version = :_version, ${updateEntries} WHERE _key = :_key`
		)

		this.#delete = new Method<{ _key: string }>(db, `DELETE FROM "${this.#table}" WHERE _key = :_key`)

		// Prepare queries
		this.#count = new Query<{}, { count: number }>(this.db, `SELECT COUNT(*) AS count FROM "${this.#table}"`)
		this.#select = new Query<{ _key: string }, { _key: string; _version: Uint8Array | null } & RecordValue>(
			this.db,
			`SELECT * FROM "${this.#table}" WHERE _key = :_key`
		)
		this.#selectAll = new Query<{}, { _key: string; _version: Uint8Array | null } & RecordValue>(
			this.db,
			`SELECT * FROM "${this.#table}"`
		)
	}

	public get(key: string): ModelValue | null {
		const record = this.#select.get({ _key: key })
		if (record === null) {
			return null
		}

		return {
			...decodeRecord(this.model, record),
			...mapValues(this.#relations, (api) => api.get(key)),
		}
	}

	public set(context: Context, key: string, value: ModelValue) {
		// no-op if an existing value takes precedence
		const { _key: existingKey = null, _version: existingVersion = null } = this.#select.get({ _key: key }) ?? {}
		if (this.resolver.lessThan(context, { version: existingVersion })) {
			return
		}

		// no-op if an existing tombstone takes precedence
		const { _version: existingTombstone = null } = this.#tombstones.select.get({ _key: key }) ?? {}
		if (this.resolver.lessThan(context, { version: existingTombstone })) {
			return
		}

		// delete the tombstone since we're about to set the value
		if (existingTombstone !== null) {
			this.#tombstones.delete.run({ _key: key })
		}

		const encodedParams = encodeRecordParams(this.model, value, this.#params)
		const version = context.version && Buffer.from(context.version)
		if (existingKey === null) {
			this.#insert.run({ _key: key, _version: version, ...encodedParams })
		} else {
			this.#update.run({ _key: key, _version: version, ...encodedParams })
		}

		for (const [name, relation] of Object.entries(this.#relations)) {
			if (existingKey !== null) {
				relation.delete(key)
			}

			relation.add(key, value[name])
		}
	}

	public delete(context: Context, key: string) {
		// no-op if an existing value takes precedence
		const { _key: existingKey = null, _version: existingVersion = null } = this.#select.get({ _key: key }) ?? {}
		if (this.resolver.lessThan(context, { version: existingVersion })) {
			return
		}

		// no-op if an existing tombstone takes precedence
		const { _version: existingTombstone = null } = this.#tombstones.select.get({ _key: key }) ?? {}
		if (this.resolver.lessThan(context, { version: existingTombstone })) {
			return
		}

		if (context.version !== null) {
			const version = Buffer.from(context.version)
			if (existingTombstone === null) {
				this.#tombstones.insert.run({ _key: key, _version: version })
			} else {
				this.#tombstones.update.run({ _key: key, _version: version })
			}
		}

		if (existingKey !== null) {
			this.#delete.run({ _key: key })
			for (const relation of Object.values(this.#relations)) {
				relation.delete(key)
			}
		}
	}

	public count(): number {
		const { count = 0 } = this.#count.get({}) ?? {}
		return count
	}

	public async *entries(): AsyncIterable<[key: string, value: ModelValue, version: Uint8Array | null]> {
		for (const { _key: key, _version: version, ...record } of this.#selectAll.iterate({})) {
			const value = {
				...decodeRecord(this.model, record),
				...mapValues(this.#relations, (api) => api.get(key)),
			}

			yield [key, value, version]
		}
	}
}

export class TombstoneAPI {
	readonly #table = getTombstoneTableName(this.model.name)

	readonly delete: Method<{ _key: string }>
	readonly insert: Method<{ _key: string; _version: Uint8Array }>
	readonly update: Method<{ _key: string; _version: Uint8Array }>
	readonly select: Query<{ _key: string }, { _version: Uint8Array }>

	public constructor(readonly db: Database, readonly model: Model) {
		// Create tombstone table
		const columns = [`_key TEXT PRIMARY KEY NOT NULL`, `_version BLOB NOT NULL`]
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${columns.join(", ")})`)

		// Prepare methods
		this.delete = new Method<{ _key: string }>(this.db, `DELETE FROM "${this.#table}" WHERE _key = :_key`)
		this.insert = new Method<{ _key: string; _version: Uint8Array }>(
			this.db,
			`INSERT INTO "${this.#table}" (_key, _version) VALUES (:_key, :_version)`
		)
		this.update = new Method<{ _key: string; _version: Uint8Array }>(
			this.db,
			`UPDATE "${this.#table}" SET _version = :_version WHERE _key = :_key`
		)

		// Prepare queries
		this.select = new Query<{ _key: string }, { _version: Uint8Array }>(
			this.db,
			`SELECT _version FROM "${this.#table}" WHERE _key = :_key`
		)
	}
}

export class RelationAPI {
	readonly #table = getRelationTableName(this.relation.source, this.relation.property)

	readonly #select: Query<{ _source: string }, { _target: string }>
	readonly #insert: Method<{ _source: string; _target: string }>
	readonly #delete: Method<{ _source: string }>

	public constructor(readonly db: Database, readonly relation: Relation) {
		const columns = [`_source TEXT NOT NULL`, `_target TEXT NOT NULL`]
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${columns.join(", ")})`)

		const sourceIndexName = getRelationSourceIndexName(relation.source, relation.property)
		db.exec(`CREATE INDEX IF NOT EXISTS "${sourceIndexName}" ON "${this.#table}" (_source)`)

		if (relation.indexed) {
			const targetIndexName = getRelationTargetIndexName(relation.source, relation.property)
			db.exec(`CREATE INDEX IF NOT EXISTS "${targetIndexName}" ON "${this.#table}" (_target)`)
		}

		// Prepare methods
		this.#insert = new Method<{ _source: string; _target: string }>(
			this.db,
			`INSERT INTO "${this.#table}" (_source, _target) VALUES (:_source, :_target)`
		)

		this.#delete = new Method<{ _source: string }>(this.db, `DELETE FROM "${this.#table}" WHERE _source = :_source`)

		// Prepare queries
		this.#select = new Query<{ _source: string }, { _target: string }>(
			this.db,
			`SELECT _target FROM "${this.#table}" WHERE _source = :_source`
		)
	}

	public get(source: string): string[] {
		const targets = this.#select.all({ _source: source })
		return targets.map(({ _target: target }) => target)
	}

	public add(source: string, targets: PropertyValue) {
		assert(Array.isArray(targets), "expected string[]")
		for (const target of targets) {
			assert(typeof target === "string", "expected string[]")
			this.#insert.run({ _source: source, _target: target })
		}
	}

	public delete(source: string) {
		this.#delete.run({ _source: source })
	}
}
