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
	QueryParams,
	WhereCondition,
	PrimitiveValue,
	RangeExpression,
	isNotExpression,
	isPrimitiveValue,
	isRangeExpression,
} from "@canvas-js/modeldb-interface"

import { decodePrimitiveValue, decodeRecord, decodeReferenceValue, encodeRecordParams } from "./encoding.js"
import { Method, Query, assert, mapEntries, mapValues, signalInvalidType, zip } from "./utils.js"

type RecordValue = Record<string, string | number | Buffer | null>
type Params = Record<`p${string}`, string | number | Buffer | null>

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
	#table = `record/${this.model.name}`
	#params: Record<string, `p${string}`> = {}
	#properties = Object.fromEntries(this.model.properties.map((property) => [property.name, property]))

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
			const indexName = `record/${model.name}/${index.join("/")}`
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

	public async query(query: QueryParams): Promise<ModelValue[]> {
		// See https://www.sqlite.org/lang_select.html for railroad diagram
		const sql: string[] = []

		// SELECT
		const [select, relations] = this.getSelectExpression(query.select)
		sql.push(`SELECT ${select} FROM "${this.#table}"`)

		// WHERE
		const [where, params] = this.getWhereExpression(query.where)
		if (where !== null) {
			sql.push(`WHERE ${where}`)
		}

		// ORDER BY
		if (query.orderBy !== undefined) {
			const orders = Object.entries(query.orderBy)
			assert(orders.length === 1, "cannot order by multiple properties at once")
			const [[name, direction]] = orders
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")
			assert(property.kind === "primitive", "cannot order by reference or relation properties")
			if (direction === "asc") {
				sql.push(`ORDER BY "${name}" ASC`)
			} else if (direction === "desc") {
				sql.push(`ORDER BY "${name}" DESC`)
			} else {
				throw new Error("invalid orderBy direction")
			}
		}

		// LIMIT
		if (typeof query.limit === "number") {
			sql.push(`LIMIT :limit`)
			params.limit = query.limit
		}

		// console.log("querying", sql, params)
		const results = this.db.prepare(sql.join(" ")).all(params)
		// console.log("results", results)
		return results.map((value): ModelValue => {
			const { _key, ...record } = value as { _key: string } & RecordValue
			return mapEntries(record, ([name, value]) => {
				const property = this.#properties[name]
				if (property.kind === "primitive") {
					return decodePrimitiveValue(this.model.name, property, value)
				} else if (property.kind === "reference") {
					return decodeReferenceValue(this.model.name, property, value)
				} else {
					throw new Error("internal error")
				}
			})
		})
	}

	private getSelectExpression(
		select: Record<string, boolean> = mapValues(this.#properties, () => true)
	): [select: string, relations: Relation[]] {
		const relations: Relation[] = []
		const columns = ["_key"]

		for (const [name, value] of Object.entries(select)) {
			if (value === false) {
				continue
			}

			const property = this.#properties[name]
			assert(property !== undefined, "property not found")
			if (property.kind === "primitive" || property.kind === "reference") {
				columns.push(`"${name}"`)
			} else if (property.kind === "relation") {
				relations.push({
					source: this.model.name,
					property: name,
					target: property.target,
					indexed: this.model.indexes.some((index) => index.length === 1 && index[0] === name),
				})
			} else {
				signalInvalidType(property)
			}
		}

		return [columns.join(", "), relations]
	}

	private getWhereExpression(
		where: WhereCondition = {}
	): [string | null, Record<string, null | number | string | Buffer>] {
		const params: Record<string, null | number | string | Buffer> = {}
		const filters = Object.entries(where).flatMap(([name, expr], i) => {
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")
			if (property.kind === "primitive") {
				if (isPrimitiveValue(expr)) {
					if (expr === null) {
						return [`"${name}" ISNULL`]
					}

					const p = `p${i}`
					params[p] = expr instanceof Uint8Array ? Buffer.from(expr) : expr
					return [`"${name}" = :${p}`]
				} else if (isNotExpression(expr)) {
					const { neq: value } = expr
					if (value === null) {
						return [`"${name}" NOTNULL`]
					}

					const p = `p${i}`
					params[p] = value instanceof Uint8Array ? Buffer.from(value) : value
					if (property.optional) {
						return [`("${name}" ISNULL OR "${name}" != :${p})`]
					} else {
						return [`"${name}" != :${p}`]
					}
				} else if (isRangeExpression(expr)) {
					const keys = Object.keys(expr) as (keyof RangeExpression)[]
					return keys.map((key, j) => {
						const value = expr[key] as PrimitiveValue
						const p = `p${i}q${j}`
						params[p] = value instanceof Uint8Array ? Buffer.from(value) : value
						switch (key) {
							case "gt":
								return `"${name}" > :${p}`
							case "gte":
								return `"${name}" >= :${p}`
							case "lt":
								return `"${name}" < :${p}`
							case "lte":
								return `"${name}" <= :${p}`
						}
					})
				} else {
					signalInvalidType(expr)
				}
			} else if (property.kind === "reference") {
				if (typeof expr === "string") {
					const p = `p${i}`
					params[p] = expr
					return [`"${name}" = :${p}`]
				} else {
					throw new Error("not implemented")
				}
			} else if (property.kind === "relation") {
				throw new Error("not implemented")
			} else {
				signalInvalidType(property)
			}
		})

		if (filters.length === 0) {
			return [null, {}]
		} else {
			return [`${filters.join(" AND ")}`, params]
		}
	}
}

export class TombstoneAPI {
	readonly #table = `tombstone/${this.model.name}`

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
	readonly #table = `relation/${this.relation.source}/${this.relation.property}`
	readonly #sourceIndex = `relation/${this.relation.source}/${this.relation.property}/source`
	readonly #targetIndex = `relation/${this.relation.source}/${this.relation.property}/target`

	readonly #select: Query<{ _source: string }, { _target: string }>
	readonly #insert: Method<{ _source: string; _target: string }>
	readonly #delete: Method<{ _source: string }>

	public constructor(readonly db: Database, readonly relation: Relation) {
		const columns = [`_source TEXT NOT NULL`, `_target TEXT NOT NULL`]
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${columns.join(", ")})`)

		db.exec(`CREATE INDEX IF NOT EXISTS "${this.#sourceIndex}" ON "${this.#table}" (_source)`)

		if (relation.indexed) {
			db.exec(`CREATE INDEX IF NOT EXISTS "${this.#targetIndex}" ON "${this.#table}" (_target)`)
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
