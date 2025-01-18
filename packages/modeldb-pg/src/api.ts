import pg from "pg"
import Cursor from "pg-cursor"

import { assert, signalInvalidType, mapValues, mapValuesAsync, zip } from "@canvas-js/utils"

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
} from "@canvas-js/modeldb"

import {
	encodePrimitiveValue,
	encodeReferenceValue,
	decodePrimitiveValue,
	decodeReferenceValue,
	encodeQueryParams,
	PostgresPrimitiveValue,
	encodePrimaryKey,
	decodePrimaryKey,
	fromBuffer,
} from "./encoding.js"

const primitiveColumnTypes = {
	integer: "BIGINT",
	float: "DOUBLE PRECISION",
	number: "DOUBLE PRECISION",
	string: "TEXT",
	bytes: "BYTEA",
	boolean: "BOOLEAN",
	json: "JSONB",
} satisfies Record<PrimitiveType, string>

function getPropertyColumnType(config: Config, model: Model, property: Property): string {
	if (property.kind === "primitive") {
		const type = primitiveColumnTypes[property.type]

		if (property.name === model.primaryKey) {
			assert(property.nullable === false)
			return `${type} PRIMARY KEY`
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
	`"${property.name}" ${getPropertyColumnType(config, model, property)}`

export class ModelAPI {
	public static async initialize(client: pg.Client, config: Config, model: Model, clear: boolean = false) {
		let primaryKey: PrimitiveProperty | null = null

		const columns: string[] = []
		const columnNames: `"${string}"`[] = []
		const references: Record<string, PrimitiveProperty> = {}
		const relations: Record<string, RelationAPI> = {}

		for (const property of model.properties) {
			if (property.kind === "primitive") {
				columns.push(getPropertyColumn(config, model, property))
				columnNames.push(`"${property.name}"`)

				if (model.primaryKey === property.name) {
					primaryKey = property
				}
			} else if (property.kind === "reference") {
				columns.push(getPropertyColumn(config, model, property))
				columnNames.push(`"${property.name}"`)

				const target = config.models.find((model) => model.name === property.target)
				assert(target !== undefined)

				const targetPrimaryKey = target.properties.find((property) => property.name === target.primaryKey)
				assert(targetPrimaryKey !== undefined)
				assert(targetPrimaryKey.kind === "primitive")

				references[property.name] = targetPrimaryKey
			} else if (property.kind === "relation") {
				const relation = config.relations.find(
					(relation) => relation.source === model.name && relation.sourceProperty === property.name,
				)
				assert(relation !== undefined, "internal error - relation not found")
				relations[property.name] = await RelationAPI.initialize(client, relation, clear)
			} else {
				signalInvalidType(property)
			}
		}

		assert(primaryKey !== null, "expected primaryKey !== null")

		const api = new ModelAPI(client, config, model, columns, columnNames, references, relations, primaryKey.name)

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

	readonly #table: string
	readonly #properties: Record<string, Property>

	readonly #columns: string[]
	readonly #columnNames: `"${string}"`[]
	readonly #relations: Record<string, RelationAPI>
	readonly #references: Record<string, PrimitiveProperty>
	readonly #primaryKeyName: string

	readonly #update: string
	readonly #insert: string
	readonly #select: string
	readonly #selectMany: string

	constructor(
		readonly client: pg.Client,
		readonly config: Config,
		readonly model: Model,
		columns: string[],
		columnNames: `"${string}"`[],
		references: Record<string, PrimitiveProperty>,
		relations: Record<string, RelationAPI>,
		primaryKeyName: string,
	) {
		this.#table = model.name
		this.#properties = Object.fromEntries(model.properties.map((property) => [property.name, property]))
		this.#columns = columns
		this.#columnNames = columnNames // quoted column names for non-relation properties
		this.#references = references
		this.#relations = relations
		this.#primaryKeyName = primaryKeyName

		const insertNames = this.#columnNames.join(", ")
		const insertParams = this.#columnNames.map((name: string, i: number) => `$${i + 1}`)
		this.#insert = `INSERT INTO "${this.#table}" (${insertNames}) VALUES (${insertParams}) ON CONFLICT DO NOTHING`

		const updateParams = this.#columnNames.map((name: string, i: number) => `$${i + 1}`)
		const updateEntries = Array.from(zip(this.#columnNames, updateParams)).map(([name, param]) => `${name} = ${param}`)
		const updateWhere = `"${this.#primaryKeyName}" = $${updateParams.length + 1}`
		this.#update = `UPDATE "${this.#table}" SET ${updateEntries.join(", ")} WHERE ${updateWhere}`

		const selectColumns = this.#columnNames.join(", ")
		this.#select = `SELECT ${selectColumns} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`
		this.#selectMany = `SELECT ${selectColumns} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = ANY($1)`
	}

	public async get(key: PrimaryKeyValue): Promise<ModelValue | null> {
		const {
			rows: [result = null],
		} = await this.client.query<Record<string, PostgresPrimitiveValue>, [PrimaryKeyValue]>(this.#select, [key])
		if (result === null) {
			return null
		}

		const relationValues = await mapValuesAsync(this.#relations, (api) => api.get(key))
		return {
			...this.decodeRecord(result),
			...relationValues,
		}
	}

	public async getMany(keys: PrimaryKeyValue[]): Promise<(ModelValue | null)[]> {
		return await Promise.all(keys.map((key) => this.get(key)))

		// let queryResult: pg.QueryResult<Record<string, PostgresPrimitiveValue>>
		// if (keys.length === 0) {
		// 	return []
		// } else if (keys.length === 1) {
		// 	queryResult = await this.client.query(this.#select, keys)
		// } else {
		// 	queryResult = await this.client.query(this.#selectMany, [keys])
		// }

		// const relations = await mapValuesAsync(this.#relations, (api) => api.getMany(keys))

		// const rowsByKey: Record<string, ModelValue> = {}
		// for (const row of queryResult.rows) {
		// 	const rowKey = row[this.#primaryKeyName] as PrimaryKeyValue

		// 	const rowRelations: Record<string, string[]> = {}
		// 	for (const relationName of Object.keys(this.#relations)) {
		// 		rowRelations[relationName] = relations[relationName][rowKey] ?? []
		// 	}

		// 	rowsByKey[rowKey] = {
		// 		...decodeRecord(this.model, row),
		// 		...rowRelations,
		// 	}
		// }

		// return keys.map((key) => rowsByKey[key] ?? null)
	}

	public async set(value: ModelValue) {
		validateModelValue(this.model, value)
		const key = value[this.#primaryKeyName] as PrimaryKeyValue

		// encodeRecordParams
		const values: Array<PostgresPrimitiveValue> = []
		for (const property of this.model.properties) {
			const propertyValue = value[property.name]
			if (propertyValue === undefined) {
				throw new Error(`missing value for property ${this.model.name}/${property.name}`)
			}

			if (property.kind === "primitive") {
				values.push(encodePrimitiveValue(this.model.name, property, value[property.name]))
			} else if (property.kind === "reference") {
				const target = this.#references[property.name]
				values.push(encodeReferenceValue(this.model.name, property, value[property.name], target))
			} else if (property.kind === "relation") {
				assert(Array.isArray(value[property.name]))
				continue
			} else {
				signalInvalidType(property)
			}
		}

		// TODO: convert to upsert for fewer queries
		const {
			rows: [existingRecord],
		} = await this.client.query(this.#select, [encodePrimaryKey(key)])

		if (existingRecord === undefined) {
			await this.client.query<{}, any[]>(this.#insert, values)
		} else {
			await this.client.query<{}, any[]>(this.#update, values.concat([encodePrimaryKey(key)]))
		}

		for (const [name, relation] of Object.entries(this.#relations)) {
			if (existingRecord !== undefined) {
				await relation.delete(key)
			}

			assert(Array.isArray(value[name]) && value[name].every(isPrimaryKey))
			await relation.add(key, value[name])
		}
	}

	public async delete(key: PrimaryKeyValue) {
		// TODO: optimize to single query
		await this.client.query(`DELETE FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`, [
			encodePrimaryKey(key),
		])

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
		const key = record[this.#primaryKeyName] as PrimaryKeyValue

		const value: ModelValue = {}
		for (const [propertyName, propertyValue] of Object.entries(record)) {
			const property = this.#properties[propertyName]
			if (property.kind === "primitive") {
				value[propertyName] = decodePrimitiveValue(this.model.name, property, propertyValue)
			} else if (property.kind === "reference") {
				const target = this.#references[property.name]
				value[propertyName] = decodeReferenceValue(this.model.name, property, propertyValue, target)
			} else if (property.kind === "relation") {
				throw new Error("internal error")
			} else {
				signalInvalidType(property)
			}
		}

		// TODO: optimize to single query
		for (const relation of relations) {
			value[relation.sourceProperty] = await this.#relations[relation.sourceProperty].get(key)
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

			const [[indexName, direction]] = orders
			const index = indexName.split("/")

			assert(!index.some((name) => this.#properties[name]?.kind === "relation"), "cannot order by relation properties")

			if (direction === "asc") {
				const orders = index.map((name) => `"${name}" ASC NULLS FIRST`).join(", ")
				sql.push(`ORDER BY ${orders}`)
			} else if (direction === "desc") {
				const orders = index.map((name) => `"${name}" DESC NULLS LAST`).join(", ")
				sql.push(`ORDER BY ${orders}`)
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

	private getWhereExpression(where: WhereCondition = {}): [where: string | null, params: PrimitiveValue[]] {
		const params: PrimitiveValue[] = []

		let i = 0
		const filters = Object.entries(where).flatMap(([name, expression]) => {
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")

			if (expression === undefined) {
				return []
			}

			if (property.kind === "primitive") {
				assert(property.type !== "json", "json properties are not supported in where clauses")

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
					if (property.nullable) {
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
					} else if (isPrimaryKey(reference)) {
						const p = ++i
						params[p - 1] = reference
						return [`"${name}" = $${p}`]
					} else {
						throw new Error("invalid reference value (expected primary key)")
					}
				} else if (isNotExpression(expression)) {
					const reference = expression.neq
					if (reference === null) {
						return [`"${name}" NOTNULL`]
					} else if (isPrimaryKey(reference)) {
						const p = ++i
						params[p - 1] = reference
						return [`"${name}" != $${p}`]
					} else {
						throw new Error("invalid reference value (expected primary key)")
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
					assert(Array.isArray(references), "invalid relation value (expected PrimaryKeyValue[])")
					const targets: string[] = []
					for (const [j, reference] of references.entries()) {
						assert(typeof reference === "string", "invalid relation value (expected PrimaryKeyValue[])")
						const p = ++i
						params[p - 1] = reference
						targets.push(
							`"${this.#primaryKeyName}" IN (SELECT _source FROM "${relationTable}" WHERE (_target = $${p}))`,
						)
					}
					return targets.length > 0 ? [targets.join(" AND ")] : []
				} else if (isNotExpression(expression)) {
					const references = expression.neq
					assert(Array.isArray(references), "invalid relation value (expected PrimaryKeyValue[])")
					const targets: string[] = []
					for (const [j, reference] of references.entries()) {
						assert(typeof reference === "string", "invalid relation value (expected PrimaryKeyValue[])")
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

	private decodeRecord(record: Record<string, PostgresPrimitiveValue>): ModelValue {
		const value: ModelValue = {}

		for (const property of this.model.properties) {
			if (property.kind === "primitive") {
				value[property.name] = decodePrimitiveValue(this.model.name, property, record[property.name])
			} else if (property.kind === "reference") {
				const targetProperty = this.#references[property.name]
				value[property.name] = decodeReferenceValue(this.model.name, property, record[property.name], targetProperty)
			} else if (property.kind === "relation") {
				continue
			} else {
				signalInvalidType(property)
			}
		}

		return value
	}
}

export class RelationAPI {
	public readonly table: string
	public readonly sourceIndex: string
	public readonly targetIndex: string

	readonly #insert
	readonly #delete: string
	readonly #select: string
	readonly #selectMany: string

	public constructor(readonly client: pg.Client, readonly relation: Relation) {
		this.table = `${relation.source}/${relation.sourceProperty}`
		this.sourceIndex = `${relation.source}/${relation.sourceProperty}/source`
		this.targetIndex = `${relation.source}/${relation.sourceProperty}/target`

		this.#insert = `INSERT INTO "${this.table}" (_source, _target) VALUES ($1, $2)`
		this.#delete = `DELETE FROM "${this.table}" WHERE _source = $1`
		this.#select = `SELECT _source, _target FROM "${this.table}" WHERE _source = $1`
		this.#selectMany = `SELECT _source, _target FROM "${this.table}" WHERE _source = ANY($1)`
	}

	public static async initialize(client: pg.Client, relation: Relation, clear: boolean) {
		// Initialize tables
		const relationApi = new RelationAPI(client, relation)
		const columns = [
			`_source ${primitiveColumnTypes[relation.sourceType]} NOT NULL`,
			`_target ${primitiveColumnTypes[relation.targetType]} NOT NULL`,
		]

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

	public async get(source: PrimaryKeyValue): Promise<PrimaryKeyValue[]> {
		const { rows } = await this.client.query<
			{ _source: PostgresPrimitiveValue; _target: PostgresPrimitiveValue },
			[PostgresPrimitiveValue]
		>(this.#select, [encodePrimaryKey(source)])

		return rows.map((row) => this.decodeRelationTarget(row._target))
	}

	private decodeRelationTarget(target: PostgresPrimitiveValue): PrimaryKeyValue {
		if (this.relation.targetType === "integer") {
			assert(typeof target === "string", "internal error - expected integer primary key")
			return parseInt(target, 10)
		} else if (this.relation.targetType === "string") {
			assert(typeof target === "string", "internal error - expected string primary key")
			return target
		} else if (this.relation.targetType === "bytes") {
			if (Buffer.isBuffer(target)) {
				return fromBuffer(target)
			} else {
				throw new Error("interal error - expected buffer primary key")
			}
		} else {
			throw new Error("internal error - invalid relation target type")
		}
	}

	public async getMany(sources: PrimaryKeyValue[]): Promise<PrimaryKeyValue[][]> {
		return await Promise.all(sources.map((source) => this.get(source)))

		// // postgres doesn't know at planning time if the array has a single string
		// let queryResult: pg.QueryResult<{ _source: PrimaryKeyValue; _target: PrimaryKeyValue }>
		// if (sources.length === 0) {
		// 	return []
		// } else if (sources.length === 1) {
		// 	queryResult = await this.client.query<{ _source: PrimaryKeyValue; _target: PrimaryKeyValue }, [PrimaryKeyValue]>(
		// 		this.#select,
		// 		[sources[0]],
		// 	)
		// } else {
		// 	queryResult = await this.client.query<
		// 		{ _source: PrimaryKeyValue; _target: PrimaryKeyValue },
		// 		[PrimaryKeyValue[]]
		// 	>(this.#selectMany, [sources])
		// }

		// const results: Record<string, string[]> = {}
		// for (const row of queryResult.rows) {
		// 	results[row._source] ||= []
		// 	results[row._source].push(row._target)
		// }

		// return results
	}

	public async add(source: PrimaryKeyValue, targets: PrimaryKeyValue[]) {
		// TODO: optimize to single query
		for (const target of targets) {
			await this.client.query(this.#insert, [encodePrimaryKey(source), encodePrimaryKey(target)])
		}
	}

	public async delete(source: PrimaryKeyValue) {
		await this.client.query(this.#delete, [encodePrimaryKey(source)])
	}
}
