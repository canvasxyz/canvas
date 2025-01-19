import { Database } from "better-sqlite3"

import { assert, signalInvalidType, mapValues } from "@canvas-js/utils"

import {
	Property,
	Relation,
	Model,
	ModelValue,
	PrimitiveType,
	QueryParams,
	WhereCondition,
	PrimitiveValue,
	RangeExpression,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	isPrimitiveValue,
	validateModelValue,
	PrimitiveProperty,
	Config,
	PrimaryKeyValue,
	isPrimaryKey,
	PrimaryKeyType,
} from "@canvas-js/modeldb"

import { zip } from "@canvas-js/utils"

import {
	decodePrimaryKey,
	decodePrimitiveValue,
	decodeRecord,
	decodeReferenceValue,
	encodePrimaryKey,
	encodeQueryParams,
	encodeRecordParams,
	RecordParams,
	RecordValue,
	SqlitePrimitiveValue,
} from "./encoding.js"
import { Method, Query } from "./utils.js"

// type RecordValue = Record<string, SqlitePrimitiveValue>
// type RecordParams = Record<`p${string}`, SqlitePrimitiveValue>

const primitiveColumnTypes = {
	integer: "INTEGER",
	float: "FLOAT",
	number: "NUMERIC",
	string: "TEXT",
	bytes: "BLOB",
	boolean: "INTEGER",
	json: "TEXT",
} satisfies Record<PrimitiveType, string>

function getPropertyColumnType(config: Config, model: Model, property: Property): string {
	if (property.kind === "primitive") {
		const type = primitiveColumnTypes[property.type]

		if (property.name === model.primaryKey) {
			assert(property.nullable === false)
			return `${type} PRIMARY KEY NOT NULL`
		}

		return property.nullable ? type : `${type} NOT NULL`
	} else if (property.kind === "reference") {
		const target = config.models.find((model) => model.name === property.target)
		assert(target !== undefined)

		const targetPrimaryKey = target.properties.find((property) => property.name === target.primaryKey)
		assert(targetPrimaryKey !== undefined)
		assert(targetPrimaryKey.kind === "primitive")

		const type = primitiveColumnTypes[targetPrimaryKey.type]
		return property.nullable ? type : `${type} NOT NULL`
	} else if (property.kind === "relation") {
		throw new Error("internal error - relation properties don't map to columns")
	} else {
		signalInvalidType(property)
	}
}

const getPropertyColumn = (config: Config, model: Model, property: Property) =>
	`'${property.name}' ${getPropertyColumnType(config, model, property)}`

export class ModelAPI {
	readonly #table: string
	readonly #params: Record<string, `p${string}`>
	readonly #properties: Record<string, Property>

	// Methods
	#insert: Method<RecordParams>
	#update: Method<RecordParams>
	#delete: Method<RecordParams>
	#clear: Method<{}>

	// Queries
	#selectAll: Query<{}, RecordValue>
	#select: Query<RecordParams, RecordValue>
	#count: Query<{}, { count: number }>

	readonly #relations: Record<string, RelationAPI> = {}
	readonly #primaryKeyName: string
	readonly #primaryKeyParam: `p${string}`

	columnNames: `"${string}"`[]

	public constructor(readonly db: Database, readonly config: Config, readonly model: Model) {
		this.#table = model.name
		this.#params = {}
		this.#properties = Object.fromEntries(model.properties.map((property) => [property.name, property]))

		const columns: string[] = []
		this.columnNames = [] // quoted column names for non-relation properties
		const columnParams: `:p${string}`[] = [] // query params for non-relation properties
		let primaryKeyIndex: number | null = null
		let primaryKey: PrimitiveProperty | null = null
		for (const [i, property] of model.properties.entries()) {
			if (property.kind === "primitive" || property.kind === "reference") {
				columns.push(getPropertyColumn(config, model, property))
				this.columnNames.push(`"${property.name}"`)
				columnParams.push(`:p${i}`)
				this.#params[property.name] = `p${i}`

				if (property.kind === "primitive" && property.name === model.primaryKey) {
					primaryKeyIndex = i
					primaryKey = property
				}
			} else if (property.kind === "relation") {
				const relation = config.relations.find(
					(relation) => relation.source === model.name && relation.sourceProperty === property.name,
				)
				assert(relation !== undefined, "internal error - relation not found")
				this.#relations[property.name] = new RelationAPI(db, relation)
			} else {
				signalInvalidType(property)
			}
		}

		assert(primaryKey !== null, "expected primaryKey !== null")
		assert(primaryKeyIndex !== null, "expected primaryKeyIndex !== null")
		// this.#primaryKeyName = columnNames[primaryKeyIndex]
		this.#primaryKeyName = primaryKey.name
		this.#primaryKeyParam = `p${primaryKeyIndex}`

		// Create record table
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${columns.join(", ")})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = `${model.name}/${index.join("/")}`
			const indexColumns = index.map((name) => `'${name}'`)
			db.exec(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.#table}" (${indexColumns.join(", ")})`)
		}

		// Prepare methods
		const insertNames = this.columnNames.join(", ")
		const insertParams = columnParams.join(", ")
		this.#insert = new Method<RecordParams>(
			db,
			`INSERT OR IGNORE INTO "${this.#table}" (${insertNames}) VALUES (${insertParams})`,
		)

		const where = `WHERE "${this.#primaryKeyName}" = :${this.#primaryKeyParam}`
		const updateEntries = Array.from(zip(this.columnNames, columnParams)).map(([name, param]) => `${name} = ${param}`)

		this.#update = new Method<RecordParams>(db, `UPDATE "${this.#table}" SET ${updateEntries.join(", ")} ${where}`)
		this.#delete = new Method<RecordParams>(db, `DELETE FROM "${this.#table}" ${where}`)

		this.#clear = new Method<{}>(db, `DELETE FROM "${this.#table}"`)

		// Prepare queries
		this.#count = new Query<{}, { count: number }>(this.db, `SELECT COUNT(*) AS count FROM "${this.#table}"`)
		this.#select = new Query<RecordParams, RecordValue>(
			this.db,
			`SELECT ${this.columnNames.join(", ")} FROM "${this.#table}" ${where}`,
		)

		this.#selectAll = new Query<{}, RecordValue>(this.db, `SELECT ${this.columnNames.join(", ")} FROM "${this.#table}"`)
	}

	public get(key: PrimaryKeyValue): ModelValue | null {
		const record = this.#select.get({ [this.#primaryKeyParam]: encodePrimaryKey(key) })
		if (record === null) {
			return null
		}

		return {
			...decodeRecord(this.model, record),
			...mapValues(this.#relations, (api) => api.get(key)),
		}
	}

	public getMany(keys: string[]): (ModelValue | null)[] {
		return keys.map((key) => this.get(key))
	}

	public set(value: ModelValue) {
		validateModelValue(this.model, value)
		const key = value[this.#primaryKeyName] as PrimaryKeyValue

		const encodedParams = encodeRecordParams(this.model, value, this.#params)

		const existingRecord = this.#select.get({ [this.#primaryKeyParam]: encodePrimaryKey(key) })
		if (existingRecord === null) {
			this.#insert.run(encodedParams)
		} else {
			this.#update.run(encodedParams)
		}

		for (const [name, relation] of Object.entries(this.#relations)) {
			if (existingRecord !== null) {
				relation.delete(key)
			}

			assert(Array.isArray(value[name]) && value[name].every(isPrimaryKey))
			relation.add(key, value[name])
		}
	}

	public delete(key: PrimaryKeyValue) {
		const params = { [this.#primaryKeyParam]: encodePrimaryKey(key) }
		const existingRecord = this.#select.get(params)
		if (existingRecord === null) {
			return
		}

		this.#delete.run(params)
		for (const relation of Object.values(this.#relations)) {
			relation.delete(key)
		}
	}

	public clear() {
		const existingRecords = this.#selectAll.all({}) // TODO: use this.#selectAll.iterate({})

		this.#clear.run({})

		for (const record of existingRecords) {
			const key = record[this.#primaryKeyParam]
			for (const relation of Object.values(this.#relations)) {
				if (!key || typeof key !== "string") continue
				relation.delete(key)
			}
		}
	}

	public count(where?: WhereCondition): number {
		const sql: string[] = []

		// SELECT
		sql.push(`SELECT COUNT(*) AS count FROM "${this.#table}"`)

		// WHERE
		const [whereExpression, params] = this.getWhereExpression(where)

		if (whereExpression) {
			sql.push(`WHERE ${whereExpression}`)
		}

		const results = this.db.prepare(sql.join(" ")).all(params) as RecordValue[]

		const countResult = results[0].count
		if (typeof countResult === "number") {
			return countResult
		} else {
			throw new Error("internal error")
		}
	}

	public query(query: QueryParams): ModelValue[] {
		const [sql, relations, params] = this.parseQuery(query)
		const results = this.db.prepare<QueryParams, RecordValue>(sql).all(encodeQueryParams(params))
		return results.map((record) => this.parseRecord(record, relations))
	}

	public *iterate(query: QueryParams): Iterable<ModelValue> {
		const [sql, relations, params] = this.parseQuery(query)

		for (const record of this.db.prepare<{}, RecordValue>(sql).iterate(encodeQueryParams(params))) {
			yield this.parseRecord(record, relations)
		}
	}

	private parseRecord(record: RecordValue, relations: Relation[]): ModelValue {
		const key = record[this.#primaryKeyName] as PrimaryKeyType

		const value: ModelValue = {}
		for (const [propertyName, propertyValue] of Object.entries(record)) {
			const property = this.#properties[propertyName]
			if (property.kind === "primitive") {
				value[propertyName] = decodePrimitiveValue(this.model.name, property, propertyValue)
			} else if (property.kind === "reference") {
				value[propertyName] = decodeReferenceValue(this.model.name, property, propertyValue)
			} else if (property.kind === "relation") {
				throw new Error("internal error")
			} else {
				signalInvalidType(property)
			}
		}

		for (const relation of relations) {
			value[relation.sourceProperty] = this.#relations[relation.sourceProperty].get(key)
		}

		return value
	}

	private parseQuery(query: QueryParams): [sql: string, relations: Relation[], params: Record<string, PrimitiveValue>] {
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
			const [[indexName, direction]] = orders
			const index = indexName.split("/")

			assert(!index.some((name) => this.#properties[name]?.kind === "relation"), "cannot order by relation properties")

			if (direction === "asc") {
				const orders = index.map((name) => `"${name}" ASC`).join(", ")
				sql.push(`ORDER BY ${orders}`)
			} else if (direction === "desc") {
				const orders = index.map((name) => `"${name}" DESC`).join(", ")
				sql.push(`ORDER BY ${orders}`)
			} else {
				throw new Error("invalid orderBy direction")
			}
		}

		// LIMIT
		if (typeof query.limit === "number") {
			sql.push(`LIMIT :limit`)
			params.limit = query.limit
		}

		// OFFSET
		if (typeof query.offset === "number") {
			sql.push(`OFFSET :offset`)
			params.offset = query.offset
		}

		// JOIN (not supported)
		if (query.include) {
			throw new Error("cannot use 'include' in queries outside the browser/idb")
		}

		return [sql.join(" "), relations, params]
	}

	private getSelectExpression(
		select: Record<string, boolean> = mapValues(this.#properties, () => true),
	): [select: string, relations: Relation[]] {
		const relations: Relation[] = []
		const columns = []

		for (const [name, value] of Object.entries(select)) {
			if (value === false) {
				continue
			}

			const property = this.#properties[name]
			assert(property !== undefined, "property not found")
			if (property.kind === "primitive" || property.kind === "reference") {
				columns.push(`"${name}"`)
			} else if (property.kind === "relation") {
				relations.push(this.#relations[name].relation)
			} else {
				signalInvalidType(property)
			}
		}

		assert(columns.length > 0, "cannot query an empty select expression")
		assert(columns.includes(`"${this.#primaryKeyName}"`), "select expression must include the primary key")
		return [columns.join(", "), relations]
	}

	private getWhereExpression(
		where: WhereCondition = {},
	): [where: string | null, params: Record<string, PrimitiveValue>] {
		const params: Record<string, PrimitiveValue> = {}
		const filters = Object.entries(where).flatMap(([name, expression], i) => {
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")

			if (expression === undefined) {
				return []
			}

			if (property.kind === "primitive") {
				if (property.type === "json") {
					throw new Error("json properties are not supported in where clauses")
				}
				if (isLiteralExpression(expression)) {
					if (expression === null) {
						return [`"${name}" ISNULL`]
					} else if (Array.isArray(expression)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					} else {
						assert(isPrimitiveValue(expression))
						const p = `p${i}`
						params[p] = expression
						return [`"${name}" = :${p}`]
					}
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (value === undefined) {
						return []
					} else if (value === null) {
						return [`"${name}" NOTNULL`]
					} else if (Array.isArray(value)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					}

					assert(isPrimitiveValue(value))

					const p = `p${i}`
					params[p] = value
					if (property.nullable) {
						return [`("${name}" ISNULL OR "${name}" != :${p})`]
					} else {
						return [`"${name}" != :${p}`]
					}
				} else if (isRangeExpression(expression)) {
					const keys = Object.keys(expression) as (keyof RangeExpression)[]

					return keys
						.filter((key) => expression[key] !== undefined)
						.flatMap((key, j) => {
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
						targets.push(
							`"${this.#primaryKeyName}" IN (SELECT _source FROM "${relationTable}" WHERE (_target = :${p}))`,
						)
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
						targets.push(
							`"${this.#primaryKeyName}" NOT IN (SELECT _source FROM "${relationTable}" WHERE (_target = :${p}))`,
						)
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

export class RelationAPI {
	public readonly table: string
	public readonly sourceIndex: string
	public readonly targetIndex: string

	readonly #select: Query<{ _source: SqlitePrimitiveValue }, { _target: SqlitePrimitiveValue }>
	readonly #insert: Method<{ _source: SqlitePrimitiveValue; _target: SqlitePrimitiveValue }>
	readonly #delete: Method<{ _source: SqlitePrimitiveValue }>

	public constructor(readonly db: Database, readonly relation: Relation) {
		this.table = `${relation.source}/${relation.sourceProperty}`
		this.sourceIndex = `${relation.source}/${relation.sourceProperty}/source`
		this.targetIndex = `${relation.source}/${relation.sourceProperty}/target`

		const columns = [
			`_source ${primitiveColumnTypes[relation.sourcePrimaryKey.type]} NOT NULL`,
			`_target ${primitiveColumnTypes[relation.targetPrimaryKey.type]} NOT NULL`,
		]

		db.exec(`CREATE TABLE IF NOT EXISTS "${this.table}" (${columns.join(", ")})`)

		db.exec(`CREATE INDEX IF NOT EXISTS "${this.sourceIndex}" ON "${this.table}" (_source)`)

		if (relation.indexed) {
			db.exec(`CREATE INDEX IF NOT EXISTS "${this.targetIndex}" ON "${this.table}" (_target)`)
		}

		// Prepare methods
		this.#insert = new Method<{ _source: SqlitePrimitiveValue; _target: SqlitePrimitiveValue }>(
			this.db,
			`INSERT INTO "${this.table}" (_source, _target) VALUES (:_source, :_target)`,
		)

		this.#delete = new Method<{ _source: SqlitePrimitiveValue }>(
			this.db,
			`DELETE FROM "${this.table}" WHERE _source = :_source`,
		)

		// Prepare queries
		this.#select = new Query<{ _source: SqlitePrimitiveValue }, { _target: SqlitePrimitiveValue }>(
			this.db,
			`SELECT _target FROM "${this.table}" WHERE _source = :_source`,
		)
	}

	public get(source: PrimaryKeyValue): PrimaryKeyValue[] {
		const targets = this.#select.all({ _source: encodePrimaryKey(source) })
		return targets.map(({ _target: target }) => decodePrimaryKey(target))
	}

	public add(source: PrimaryKeyValue, targets: PrimaryKeyValue[]) {
		assert(Array.isArray(targets), "expected PrimaryKey[]")
		for (const target of targets) {
			this.#insert.run({ _source: encodePrimaryKey(source), _target: encodePrimaryKey(target) })
		}
	}

	public delete(source: PrimaryKeyValue) {
		this.#delete.run({ _source: encodePrimaryKey(source) })
	}
}
