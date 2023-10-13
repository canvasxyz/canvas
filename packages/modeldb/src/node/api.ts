import { Database } from "better-sqlite3"
import { logger } from "@libp2p/logger"

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
} from "../types.js"

import { decodePrimitiveValue, decodeRecord, decodeReferenceValue, encodeRecordParams } from "./encoding.js"
import { Method, Query } from "./utils.js"
import { isNotExpression, isLiteralExpression, isRangeExpression } from "../query.js"
import { assert, mapValues, signalInvalidType, zip } from "../utils.js"

type RecordValue = Record<string, string | number | Buffer | null>
type Params = Record<`p${string}`, string | number | Buffer | null>

const primitiveColumnTypes = {
	integer: "INTEGER",
	float: "FLOAT",
	string: "TEXT",
	bytes: "BLOB",
} satisfies Record<PrimitiveType, string>

function getPropertyColumnType(property: Property): string {
	if (property.kind === "primary") {
		return "TEXT PRIMARY KEY NOT NULL"
	} else if (property.kind === "primitive") {
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
	private readonly log = logger(`canvas:modeldb:[${this.model.name}]`)

	#table = `model/${this.model.name}`
	#params: Record<string, `p${string}`> = {}
	#properties = Object.fromEntries(this.model.properties.map((property) => [property.name, property]))

	// Methods
	#insert: Method<{ _version: Uint8Array | null } & Params>
	#update: Method<{ _version: Uint8Array | null } & RecordValue>
	#delete: Method<Record<`p${string}`, string>>

	// Queries
	#selectAll: Query<{}, { _version: Uint8Array | null } & RecordValue>
	#select: Query<Record<`p${string}`, string>, { _version: Uint8Array | null } & RecordValue>
	#count: Query<{}, { count: number }>

	// Tombstone API
	#tombstones = new TombstoneAPI(this.db, this.model)

	readonly #relations: Record<string, RelationAPI> = {}
	readonly #primaryKeyName: string
	readonly #primaryKeyParam: `p${string}`

	public constructor(readonly db: Database, readonly model: Model, readonly resolver: Resolver) {
		const columns = [`_version BLOB`]
		const columnNames: `"${string}"`[] = [] // quoted column names for non-relation properties
		const columnParams: `:p${string}`[] = [] // query params for non-relation properties
		let primaryKeyIndex: number | null = null
		for (const [i, property] of model.properties.entries()) {
			if (property.kind === "primary" || property.kind === "primitive" || property.kind === "reference") {
				columns.push(getPropertyColumn(property))
				columnNames.push(`"${property.name}"`)
				columnParams.push(`:p${i}`)
				this.#params[property.name] = `p${i}`

				if (property.kind === "primary") {
					primaryKeyIndex = i
				}
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

		assert(primaryKeyIndex !== null, "expected primaryKeyIndex !== null")
		this.#primaryKeyName = columnNames[primaryKeyIndex]
		this.#primaryKeyParam = `p${primaryKeyIndex}`

		// Create record table
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${columns.join(", ")})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = `record/${model.name}/${index.join("/")}`
			const indexColumns = index.map((name) => `'${name}'`)
			db.exec(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.#table}" (${indexColumns.join(", ")})`)
		}

		// Prepare methods
		const insertNames = ["_version", ...columnNames].join(", ")
		const insertParams = [":_version", ...columnParams].join(", ")
		this.#insert = new Method<{ _version: Uint8Array | null } & Params>(
			db,
			`INSERT OR IGNORE INTO "${this.#table}" (${insertNames}) VALUES (${insertParams})`
		)

		const updateEntries = zip(
			["_version", ...columnNames.filter((_, i) => i !== primaryKeyIndex)],
			[":_version", ...columnParams.filter((_, i) => i !== primaryKeyIndex)]
		)
			.map(([name, param]) => `${name} = ${param}`)
			.join(", ")

		this.#update = new Method<{ _version: Uint8Array | null } & Params>(
			db,
			`UPDATE "${this.#table}" SET _version = :_version, ${updateEntries} WHERE ${this.#primaryKeyName} = ${
				this.#primaryKeyParam
			}`
		)

		this.#delete = new Method<Record<`p${string}`, string>>(
			db,
			`DELETE FROM "${this.#table}" WHERE ${this.#primaryKeyName} = ${this.#primaryKeyParam}`
		)

		// Prepare queries
		this.#count = new Query<{}, { count: number }>(this.db, `SELECT COUNT(*) AS count FROM "${this.#table}"`)
		this.#select = new Query<Record<string, `p${string}`>, { _version: Uint8Array | null } & RecordValue>(
			this.db,
			`SELECT * FROM "${this.#table}" WHERE ${this.#primaryKeyName} = ${this.#primaryKeyParam}`
		)
		this.#selectAll = new Query<{}, { _key: string; _version: Uint8Array | null } & RecordValue>(
			this.db,
			`SELECT * FROM "${this.#table}"`
		)
	}

	public get(key: string): ModelValue | null {
		const record = this.#select.get({ [this.#primaryKeyParam]: key })
		if (record === null) {
			return null
		}

		return {
			...decodeRecord(this.model, record),
			...mapValues(this.#relations, (api) => api.get(key)),
		}
	}

	public set(context: Context, value: ModelValue) {
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

	public async *entries(): AsyncIterable<[key: string, value: ModelValue]> {
		for (const { _key: key, _version: version, ...record } of this.#selectAll.iterate({})) {
			const value = {
				...decodeRecord(this.model, record),
				...mapValues(this.#relations, (api) => api.get(key)),
			}

			yield [key, value]
		}
	}

	public query(query: QueryParams): ModelValue[] {
		// See https://www.sqlite.org/lang_select.html for railroad diagram
		const sql: string[] = []

		// SELECT
		const [select, relations] = this.getSelectExpression(query.select)
		sql.push(`SELECT ${select} FROM "${this.#table}"`)

		// WHERE
		const [where, params] = this.getWhereExpression(query.where)

		// for (const join of joins) {
		// 	sql.push(`JOIN "${join}" ON "${this.#table}"._key = "${join}".source`)
		// }

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
			assert(property.kind === "primitive" || property.kind === "reference", "cannot order by relation properties")
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

		const results = this.db.prepare(sql.join(" ")).all(params) as ({ _key: string } & RecordValue)[]
		return results.map(({ _key, ...record }): ModelValue => {
			const value: ModelValue = {}
			for (const [propertyName, propertyValue] of Object.entries(record)) {
				const property = this.#properties[propertyName]
				if (property.kind === "primitive") {
					value[propertyName] = decodePrimitiveValue(this.model.name, property, propertyValue)
				} else if (property.kind === "reference") {
					value[propertyName] = decodeReferenceValue(this.model.name, property, propertyValue)
				} else {
					throw new Error("internal error")
				}
			}

			for (const relation of relations) {
				value[relation.property] = this.#relations[relation.property].get(_key)
			}

			return value
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
			if (property.kind === "primary" || property.kind === "primitive" || property.kind === "reference") {
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
	): [where: string | null, params: Record<string, null | number | string | Buffer>] {
		const params: Record<string, null | number | string | Buffer> = {}
		const filters = Object.entries(where).flatMap(([name, expression], i) => {
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")

			if (property.kind === "primary") {
				if (isLiteralExpression(expression)) {
					if (typeof expression !== "string") {
						throw new TypeError("invalid primary key value (expected string)")
					}

					const p = `p${i}`
					params[p] = expression
					return [`"${name}" = :${p}`]
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (typeof value !== "string") {
						throw new TypeError("invalid primary key value (expected string)")
					}

					const p = `p${i}`
					params[p] = value
					return [`"${name}" != :${p}`]
				} else if (isRangeExpression(expression)) {
					const keys = Object.keys(expression) as (keyof RangeExpression)[]
					return keys.flatMap((key, j) => {
						const value = expression[key]
						if (typeof value !== "string") {
							throw new TypeError("invalid primary key value (expected string)")
						}

						const p = `p${i}q${j}`
						params[p] = value
						switch (key) {
							case "gt":
								return [`"${name}" > :${p}`]
							case "gte":
								return [`"${name}" >= :${p}`]
							case "lt":
								return [`"${name}" < :${p}`]
							case "lte":
								return [`"${name}" <= :${p}`]
						}
					})
				} else {
					signalInvalidType(expression)
				}
			} else if (property.kind === "primitive") {
				if (isLiteralExpression(expression)) {
					if (expression === null) {
						return [`"${name}" ISNULL`]
					} else if (Array.isArray(expression)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					} else {
						const p = `p${i}`
						params[p] = expression instanceof Uint8Array ? Buffer.from(expression) : expression
						return [`"${name}" = :${p}`]
					}
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (value === null) {
						return [`"${name}" NOTNULL`]
					} else if (Array.isArray(value)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					} else {
						const p = `p${i}`
						params[p] = value instanceof Uint8Array ? Buffer.from(value) : value
						if (property.optional) {
							return [`("${name}" ISNULL OR "${name}" != :${p})`]
						} else {
							return [`"${name}" != :${p}`]
						}
					}
				} else if (isRangeExpression(expression)) {
					const keys = Object.keys(expression) as (keyof RangeExpression)[]
					return keys.flatMap((key, j) => {
						const value = expression[key] as PrimitiveValue
						if (value === null) {
							switch (key) {
								case "gt":
									return [`"${name}" NOTNULL`]
								case "gte":
									return []
								case "lt":
									return ["0 = 1"]
								case "lte":
									return []
							}
						}

						const p = `p${i}q${j}`
						params[p] = value instanceof Uint8Array ? Buffer.from(value) : value
						switch (key) {
							case "gt":
								return [`("${name}" NOTNULL) AND ("${name}" > :${p})`]
							case "gte":
								return [`("${name}" NOTNULL) AND ("${name}" >= :${p})`]
							case "lt":
								return [`("${name}" ISNULL) OR ("${name}" < :${p})`]
							case "lte":
								return [`("${name}" ISNULL) OR ("${name}" <= :${p})`]
						}
					})
				} else {
					signalInvalidType(expression)
				}
			} else if (property.kind === "reference") {
				if (isLiteralExpression(expression)) {
					const reference = expression
					if (reference === null) {
						return [`"${name}" ISNULL`]
					} else if (typeof reference === "string") {
						const p = `p${i}`
						params[p] = reference
						return [`"${name}" = :${p}`]
					} else {
						throw new Error("invalid reference value (expected string | null)")
					}
				} else if (isNotExpression(expression)) {
					const reference = expression.neq
					if (reference === null) {
						return [`"${name}" NOTNULL`]
					} else if (typeof reference === "string") {
						const p = `p${i}`
						params[p] = reference
						return [`"${name}" != :${p}`]
					} else {
						throw new Error("invalid reference value (expected string | null)")
					}
				} else if (isRangeExpression(expression)) {
					throw new Error("cannot use range expressions on reference values")
				} else {
					signalInvalidType(expression)
				}
			} else if (property.kind === "relation") {
				const relationTable = this.#relations[property.name].table
				if (isLiteralExpression(expression)) {
					const references = expression
					assert(Array.isArray(references), "invalid relation value (expected string[])")
					const targets: string[] = []
					for (const [j, reference] of references.entries()) {
						assert(typeof reference === "string", "invalid relation value (expected string[])")
						const p = `p${i}q${j}`
						params[p] = reference
						targets.push(`_key IN (SELECT _source FROM "${relationTable}" WHERE (_target = :${p}))`)
					}
					return targets.length > 0 ? [targets.join(" AND ")] : []
				} else if (isNotExpression(expression)) {
					const references = expression.neq
					assert(Array.isArray(references), "invalid relation value (expected string[])")
					const targets: string[] = []
					for (const [j, reference] of references.entries()) {
						assert(typeof reference === "string", "invalid relation value (expected string[])")
						const p = `p${i}q${j}`
						params[p] = reference
						targets.push(`_key NOT IN (SELECT _source FROM "${relationTable}" WHERE (_target = :${p}))`)
					}
					return targets.length > 0 ? [targets.join(" AND ")] : []
				} else if (isRangeExpression(expression)) {
					throw new Error("cannot use range expressions on relation values")
				} else {
					signalInvalidType(expression)
				}
			} else {
				signalInvalidType(property)
			}
		})

		if (filters.length === 0) {
			return [null, {}]
		} else {
			return [`${filters.map((filter) => `(${filter})`).join(" AND ")}`, params]
		}
	}
}

export class TombstoneAPI {
	public readonly table = `tombstone/${this.model.name}`

	readonly delete: Method<{ _key: string }>
	readonly insert: Method<{ _key: string; _version: Uint8Array }>
	readonly update: Method<{ _key: string; _version: Uint8Array }>
	readonly select: Query<{ _key: string }, { _version: Uint8Array }>

	public constructor(readonly db: Database, readonly model: Model) {
		// Create tombstone table
		const columns = [`_key TEXT PRIMARY KEY NOT NULL`, `_version BLOB NOT NULL`]
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.table}" (${columns.join(", ")})`)

		// Prepare methods
		this.delete = new Method<{ _key: string }>(this.db, `DELETE FROM "${this.table}" WHERE _key = :_key`)
		this.insert = new Method<{ _key: string; _version: Uint8Array }>(
			this.db,
			`INSERT INTO "${this.table}" (_key, _version) VALUES (:_key, :_version)`
		)
		this.update = new Method<{ _key: string; _version: Uint8Array }>(
			this.db,
			`UPDATE "${this.table}" SET _version = :_version WHERE _key = :_key`
		)

		// Prepare queries
		this.select = new Query<{ _key: string }, { _version: Uint8Array }>(
			this.db,
			`SELECT _version FROM "${this.table}" WHERE _key = :_key`
		)
	}
}

export class RelationAPI {
	public readonly table = `relation/${this.relation.source}/${this.relation.property}`
	public readonly sourceIndex = `relation/${this.relation.source}/${this.relation.property}/source`
	public readonly targetIndex = `relation/${this.relation.source}/${this.relation.property}/target`

	readonly #select: Query<{ _source: string }, { _target: string }>
	readonly #insert: Method<{ _source: string; _target: string }>
	readonly #delete: Method<{ _source: string }>

	public constructor(readonly db: Database, readonly relation: Relation) {
		const columns = [`_source TEXT NOT NULL`, `_target TEXT NOT NULL`]
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.table}" (${columns.join(", ")})`)

		db.exec(`CREATE INDEX IF NOT EXISTS "${this.sourceIndex}" ON "${this.table}" (_source)`)

		if (relation.indexed) {
			db.exec(`CREATE INDEX IF NOT EXISTS "${this.targetIndex}" ON "${this.table}" (_target)`)
		}

		// Prepare methods
		this.#insert = new Method<{ _source: string; _target: string }>(
			this.db,
			`INSERT INTO "${this.table}" (_source, _target) VALUES (:_source, :_target)`
		)

		this.#delete = new Method<{ _source: string }>(this.db, `DELETE FROM "${this.table}" WHERE _source = :_source`)

		// Prepare queries
		this.#select = new Query<{ _source: string }, { _target: string }>(
			this.db,
			`SELECT _target FROM "${this.table}" WHERE _source = :_source`
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
