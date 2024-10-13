import pg from "pg"
import Cursor from "pg-cursor"

import { assert, signalInvalidType, mapValues, mapValuesAsync, zip } from "@canvas-js/utils"

import {
	Property,
	Relation,
	Model,
	ModelValue,
	PropertyValue,
	PrimitiveType,
	QueryParams,
	WhereCondition,
	PrimitiveValue,
	RangeExpression,
	PrimaryKeyProperty,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	isPrimitiveValue,
	validateModelValue,
} from "@canvas-js/modeldb"

import {
	encodePrimaryKeyValue,
	encodePrimitiveValue,
	encodeReferenceValue,
	decodePrimaryKeyValue,
	decodePrimitiveValue,
	decodeRecord,
	decodeReferenceValue,
	encodeQueryParams,
	PostgresPrimitiveValue,
} from "./encoding.js"

const primitiveColumnTypes = {
	integer: "BIGINT",
	float: "DECIMAL",
	number: "DOUBLE PRECISION",
	string: "TEXT",
	bytes: "BYTEA",
	boolean: "BOOLEAN",
	json: "TEXT",
} satisfies Record<PrimitiveType, string>

function getPropertyColumnType(property: Property): string {
	if (property.kind === "primary") {
		return "TEXT PRIMARY KEY"
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

const getPropertyColumn = (property: Property) => `"${property.name}" ${getPropertyColumnType(property)}`

export class ModelAPI {
	#table = this.model.name
	#properties = Object.fromEntries(this.model.properties.map((property) => [property.name, property]))

	readonly #columns: string[]
	readonly #columnNames: `"${string}"`[]
	readonly #relations: Record<string, RelationAPI> = {}
	readonly #primaryKeyName: string

	constructor(
		readonly client: pg.Client,
		readonly model: Model,
		columns: string[],
		columnNames: `"${string}"`[],
		relations: Record<string, RelationAPI> = {},
		primaryKeyName: string,
	) {
		this.#columns = columns
		this.#columnNames = columnNames // quoted column names for non-relation properties
		this.#relations = relations
		this.#primaryKeyName = primaryKeyName
	}

	public static async initialize(client: pg.Client, model: Model, clear: boolean = false) {
		let primaryKeyIndex: number | null = null
		let primaryKey: PrimaryKeyProperty | null = null
		let primaryKeyName: string | null

		const columns: string[] = []
		const columnNames: `"${string}"`[] = []
		const relations: Record<string, RelationAPI> = {}

		for (const [i, property] of model.properties.entries()) {
			if (property.kind === "primary" || property.kind === "primitive" || property.kind === "reference") {
				columns.push(getPropertyColumn(property))
				columnNames.push(`"${property.name}"`)

				if (property.kind === "primary") {
					primaryKeyIndex = i
					primaryKey = property
				}
			} else if (property.kind === "relation") {
				relations[property.name] = await RelationAPI.initialize(
					client,
					{
						source: model.name,
						property: property.name,
						target: property.target,
						indexed: false,
					},
					clear,
				)
			} else {
				signalInvalidType(property)
			}
		}

		assert(primaryKey !== null, "expected primaryKey !== null")
		assert(primaryKeyIndex !== null, "expected primaryKeyIndex !== null")

		const api = new ModelAPI(client, model, columns, columnNames, relations, primaryKey.name)

		const queries = []

		// Create record table
		if (clear) {
			queries.push(`DROP TABLE IF EXISTS "${api.#table}"`)
		}
		queries.push(`CREATE TABLE IF NOT EXISTS "${api.#table}" (${api.#columns.join(", ")})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = `${model.name}/${index.join("/")}`
			const indexColumns = index.map((name) => `"${name}"`)
			queries.push(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${api.#table}" (${indexColumns.join(", ")})`)
		}
		await client.query(queries.join("; "))

		return api
	}

	public async get(key: string): Promise<ModelValue | null> {
		return (await this.getMany([key]))[0]
	}

	public async getMany(keys: string[]): Promise<(ModelValue | null)[]> {
		let queryResult
		if (keys.length === 1) {
			queryResult = await this.client.query(
				`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`,
				[keys[0]],
			)
		} else {
			queryResult = await this.client.query(
				`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = ANY($1)`,
				[keys],
			)
		}

		const relations = await mapValuesAsync(this.#relations, (api) => api.getMany(keys))

		const rowsByKey: Record<string, ModelValue> = {}
		for (const row of queryResult.rows) {
			const rowKey = row[this.#primaryKeyName]
			assert(typeof rowKey === "string", 'expected typeof primaryKey === "string"')

			const rowRelations: Record<string, string[]> = {}
			for (const relationName of Object.keys(this.#relations)) {
				rowRelations[relationName] = relations[relationName][rowKey]
			}

			rowsByKey[rowKey] = {
				...decodeRecord(this.model, row),
				...rowRelations,
			}
		}

		return keys.map((key) => rowsByKey[key] ?? null)
	}

	public async set(value: ModelValue) {
		validateModelValue(this.model, value)
		const key = value[this.#primaryKeyName]
		assert(typeof key === "string", 'expected typeof primaryKey === "string"')

		// encodeRecordParams
		const values: Array<string | number | boolean | Uint8Array | null> = []
		for (const property of this.model.properties) {
			const propertyValue = value[property.name]
			if (propertyValue === undefined) {
				throw new Error(`missing value for property ${this.model.name}/${property.name}`)
			}

			if (property.kind === "primary") {
				values.push(encodePrimaryKeyValue(this.model.name, property, value[property.name]))
			} else if (property.kind === "primitive") {
				values.push(encodePrimitiveValue(this.model.name, property, value[property.name]))
			} else if (property.kind === "reference") {
				values.push(encodeReferenceValue(this.model.name, property, value[property.name]))
			} else if (property.kind === "relation") {
				assert(Array.isArray(value[property.name]))
				continue
			} else {
				signalInvalidType(property)
			}
		}

		// TODO: convert to upsert for fewer queries
		const existingRecord = (
			await this.client.query(
				`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`,
				[key],
			)
		).rows[0]

		if (existingRecord === undefined) {
			const insertNames = this.#columnNames.join(", ")
			const insertParams = this.#columnNames.map((name: string, i: number) => `$${i + 1}`)

			await this.client.query<{}, any[]>(
				`INSERT INTO "${this.#table}" (${insertNames}) VALUES (${insertParams}) ON CONFLICT DO NOTHING`,
				values,
			)
		} else {
			const updateParams = this.#columnNames.map((name: string, i: number) => `$${i + 1}`)
			const updateEntries = Array.from(zip(this.#columnNames, updateParams)).map(
				([name, param]) => `${name} = ${param}`,
			)

			await this.client.query<{}, any[]>(
				`UPDATE "${this.#table}" SET ${updateEntries.join(", ")} WHERE "${this.#primaryKeyName}" = $${
					updateParams.length + 1
				}`,
				values.concat([key]),
			)
		}

		for (const [name, relation] of Object.entries(this.#relations)) {
			if (existingRecord !== undefined) {
				await relation.delete(key)
			}

			await relation.add(key, value[name])
		}
	}

	public async delete(key: string) {
		// TODO: optimize to single query
		await this.client.query(`DELETE FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`, [key])

		for (const relation of Object.values(this.#relations)) {
			await relation.delete(key)
		}
	}

	public async count(where?: WhereCondition): Promise<number> {
		const sql: string[] = []

		// SELECT
		sql.push(`SELECT COUNT(*) AS count FROM "${this.#table}"`)

		// WHERE
		const [whereExpression, params] = this.getWhereExpression(where)

		if (whereExpression) {
			sql.push(`WHERE ${whereExpression}`)
		}
		const results = await this.client.query(sql.join(" "), encodeQueryParams(params))
		return parseInt(results.rows[0].count, 10) ?? 0
	}

	public async clear() {
		const results = await this.client.query(`DELETE FROM "${this.#table}" RETURNING "${this.#primaryKeyName}"`)

		for (const row of results.rows) {
			const key = row[this.#primaryKeyName].id
			for (const relation of Object.values(this.#relations)) {
				await relation.delete(key)
			}
		}
	}

	// public async *values(): AsyncIterable<ModelValue> {
	// 	// TODO: optimize to single query
	// 	// TODO: use iterable query
	// 	const { rows } = await this.client.query(`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}"`)

	// 	this.client

	// 	for (const row of rows) {
	// 		const key = row[this.#primaryKeyName]
	// 		assert(typeof key === "string", 'expected typeof key === "string"')
	// 		const relations = await mapValuesAsync(this.#relations, (api) => api.get(key))
	// 		const value = {
	// 			...decodeRecord(this.model, row),
	// 			...relations,
	// 		}

	// 		yield value
	// 	}
	// }

	public async *iterate(query: QueryParams): AsyncIterable<ModelValue> {
		const [sql, relations, params] = this.parseQuery(query)
		const cursor = this.client.query(new Cursor(sql, encodeQueryParams(params)))
		let resultCount
		try {
			do {
				const results = await cursor.read(3)
				resultCount = results.length
				for (const record of results) {
					yield await this.parseRecord(record, relations)
				}
			} while (resultCount > 0)
		} finally {
			await cursor.close()
		}
	}

	public async query(query: QueryParams): Promise<ModelValue[]> {
		const [sql, relations, params] = this.parseQuery(query)

		const results = await this.client.query<Record<string, PostgresPrimitiveValue>, any[]>(
			sql,
			encodeQueryParams(params),
		)

		const values = []
		for (const record of results.rows) {
			const value = await this.parseRecord(record, relations)
			values.push(value)
		}

		return values
	}

	private async parseRecord(
		record: Record<string, PostgresPrimitiveValue>,
		relations: Relation[],
	): Promise<ModelValue> {
		const key = record[this.#primaryKeyName]
		assert(typeof key === "string", 'expected typeof primaryKey === "string"')

		const value: ModelValue = {}
		for (const [propertyName, propertyValue] of Object.entries(record)) {
			const property = this.#properties[propertyName]
			if (property.kind === "primary") {
				value[propertyName] = decodePrimaryKeyValue(this.model.name, property, propertyValue)
			} else if (property.kind === "primitive") {
				value[propertyName] = decodePrimitiveValue(this.model.name, property, propertyValue)
			} else if (property.kind === "reference") {
				value[propertyName] = decodeReferenceValue(this.model.name, property, propertyValue)
			} else if (property.kind === "relation") {
				throw new Error("internal error")
			} else {
				signalInvalidType(property)
			}
		}

		// TODO: optimize to single query
		for (const relation of relations) {
			value[relation.property] = await this.#relations[relation.property].get(key)
		}

		return value
	}

	private parseQuery(query: QueryParams): [sql: string, relations: Relation[], params: PrimitiveValue[]] {
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
			assert(
				property.kind === "primary" || property.kind === "primitive" || property.kind === "reference",
				"cannot order by relation properties",
			)

			if (direction === "asc") {
				sql.push(`ORDER BY "${name}" ASC NULLS FIRST`)
			} else if (direction === "desc") {
				sql.push(`ORDER BY "${name}" DESC NULLS LAST`)
			} else {
				throw new Error("invalid orderBy direction")
			}
		}

		// LIMIT
		if (typeof query.limit === "number") {
			sql.push(`LIMIT $${params.length + 1}`)
			params.push(query.limit)
		}

		// OFFSET
		if (typeof query.offset === "number") {
			sql.push(`OFFSET $${params.length + 1}`)
			params.push(query.offset)
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

		assert(columns.length > 0, "cannot query an empty select expression")
		assert(columns.includes(`"${this.#primaryKeyName}"`), "select expression must include the primary key")
		return [columns.join(", "), relations]
	}

	private getWhereExpression(where: WhereCondition = {}): [where: string | null, params: PrimitiveValue[]] {
		const params: PrimitiveValue[] = []

		let i = 0
		const filters = Object.entries(where).flatMap(([name, expression]) => {
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")

			if (expression === undefined) {
				return []
			}

			if (property.kind === "primary") {
				if (isLiteralExpression(expression)) {
					if (typeof expression !== "string") {
						throw new TypeError("invalid primary key value (expected string)")
					}

					const p = ++i
					params[p - 1] = expression
					return [`"${name}" = $${p}`]
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (typeof value !== "string") {
						throw new TypeError("invalid primary key value (expected string)")
					}

					const p = ++i
					params[p - 1] = value
					return [`"${name}" != $${p}`]
				} else if (isRangeExpression(expression)) {
					const keys = Object.keys(expression) as (keyof RangeExpression)[]

					return keys
						.filter((key) => expression[key] !== undefined)
						.flatMap((key, j) => {
							const value = expression[key]
							if (typeof value !== "string") {
								throw new TypeError("invalid primary key value (expected string)")
							}

							const p = ++i
							params[p - 1] = value
							switch (key) {
								case "gt":
									return [`"${name}" > $${p}`]
								case "gte":
									return [`"${name}" >= $${p}`]
								case "lt":
									return [`"${name}" < $${p}`]
								case "lte":
									return [`"${name}" <= $${p}`]
							}
						})
				} else {
					signalInvalidType(expression)
				}
			} else if (property.kind === "primitive") {
				if (property.type === "json") {
					throw new Error("json properties are not supported in where clauses")
				}
				if (isLiteralExpression(expression)) {
					assert(isPrimitiveValue(expression))
					if (expression === null) {
						return [`"${name}" ISNULL`]
					} else if (Array.isArray(expression)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					} else {
						const p = ++i
						params[p - 1] = expression instanceof Uint8Array ? Buffer.from(expression) : expression
						return [`"${name}" = $${p}`]
					}
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (value === undefined) {
						return []
					} else if (value === null) {
						return [`"${name}" NOTNULL`]
					} else if (Array.isArray(value)) {
						throw new Error("invalid primitive value (expected null | number | string | boolean | Uint8Array)")
					}

					assert(isPrimitiveValue(value))

					const p = ++i
					params[p - 1] = value instanceof Uint8Array ? Buffer.from(value) : value
					if (property.optional) {
						return [`("${name}" ISNULL OR "${name}" != $${p})`]
					} else {
						return [`"${name}" != $${p}`]
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

							const p = ++i
							params[p - 1] = value instanceof Uint8Array ? Buffer.from(value) : value
							switch (key) {
								case "gt":
									return [`("${name}" NOTNULL) AND ("${name}" > $${p})`]
								case "gte":
									return [`("${name}" NOTNULL) AND ("${name}" >= $${p})`]
								case "lt":
									return [`("${name}" ISNULL) OR ("${name}" < $${p})`]
								case "lte":
									return [`("${name}" ISNULL) OR ("${name}" <= $${p})`]
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
						const p = ++i
						params[p - 1] = reference
						return [`"${name}" = $${p}`]
					} else {
						throw new Error("invalid reference value (expected string | null)")
					}
				} else if (isNotExpression(expression)) {
					const reference = expression.neq
					if (reference === null) {
						return [`"${name}" NOTNULL`]
					} else if (typeof reference === "string") {
						const p = ++i
						params[p - 1] = reference
						return [`"${name}" != $${p}`]
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
						const p = ++i
						params[p - 1] = reference
						targets.push(
							`"${this.#primaryKeyName}" IN (SELECT _source FROM "${relationTable}" WHERE (_target = $${p}))`,
						)
					}
					return targets.length > 0 ? [targets.join(" AND ")] : []
				} else if (isNotExpression(expression)) {
					const references = expression.neq
					assert(Array.isArray(references), "invalid relation value (expected string[])")
					const targets: string[] = []
					for (const [j, reference] of references.entries()) {
						assert(typeof reference === "string", "invalid relation value (expected string[])")
						const p = ++i
						params[p - 1] = reference
						targets.push(
							`"${this.#primaryKeyName}" NOT IN (SELECT _source FROM "${relationTable}" WHERE (_target = $${p}))`,
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
			return [null, []]
		} else {
			return [`${filters.map((filter) => `(${filter})`).join(" AND ")}`, params]
		}
	}
}

export class RelationAPI {
	public readonly table = `${this.relation.source}/${this.relation.property}`
	public readonly sourceIndex = `${this.relation.source}/${this.relation.property}/source`
	public readonly targetIndex = `${this.relation.source}/${this.relation.property}/target`

	public static async initialize(client: pg.Client, relation: Relation, clear: boolean) {
		// Initialize tables
		const relationApi = new RelationAPI(client, relation)
		const columns = [`_source TEXT NOT NULL`, `_target TEXT NOT NULL`]

		const queries = []

		if (clear) {
			queries.push(`DROP TABLE IF EXISTS "${relationApi.table}"`)
		}
		queries.push(`CREATE TABLE IF NOT EXISTS "${relationApi.table}" (${columns.join(", ")})`)
		queries.push(`CREATE INDEX IF NOT EXISTS "${relationApi.sourceIndex}" ON "${relationApi.table}" (_source)`)
		if (relation.indexed) {
			queries.push(`CREATE INDEX IF NOT EXISTS "${relationApi.targetIndex}" ON "${relationApi.table}" (_target)`)
		}
		await client.query(queries.join(";\n"))

		return relationApi
	}

	public constructor(
		readonly client: pg.Client,
		readonly relation: Relation,
	) {
		this.client = client
	}

	public async get(source: string): Promise<string[]> {
		return (await this.getMany([source]))[source]
	}

	public async getMany(sources: string[]): Promise<Record<string, string[]>> {
		// postgres doesn't know at planning time if the array has a single string
		let queryResult: { rows: { _source: string; _target: string }[] }
		if (sources.length === 1) {
			queryResult = await this.client.query<{ _source: string; _target: string }>(
				`SELECT _source, _target FROM "${this.table}" WHERE _source = $1`,
				[sources[0]],
			)
		} else {
			queryResult = await this.client.query<{ _source: string; _target: string }>(
				`SELECT _source, _target FROM "${this.table}" WHERE _source = ANY($1)`,
				[sources],
			)
		}

		const results: Record<string, string[]> = {}
		for (const row of queryResult.rows) {
			results[row._source] ||= []
			results[row._source].push(row._target)
		}
		return results
	}

	public async add(source: string, targets: PropertyValue) {
		assert(Array.isArray(targets), "expected string[]")
		// TODO: optimize to single query
		for (const target of targets) {
			assert(typeof target === "string", "expected string[]")
			await this.client.query(`INSERT INTO "${this.table}" (_source, _target) VALUES ($1, $2)`, [source, target])
		}
	}

	public async delete(source: string) {
		await this.client.query(`DELETE FROM "${this.table}" WHERE _source = $1`, [source])
	}
}
