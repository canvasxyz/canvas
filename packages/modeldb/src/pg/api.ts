import pg from "pg"

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
} from "../types.js"

import {
	encodePrimaryKeyValue,
	encodePrimitiveValue,
	encodeRecordParams,
	encodeReferenceValue,
	decodePrimaryKeyValue,
	decodePrimitiveValue,
	decodeRecord,
	decodeReferenceValue,
} from "./encoding.js"
import { isNotExpression, isLiteralExpression, isRangeExpression } from "../query.js"
import { assert, mapValues, signalInvalidType, validateModelValue, zip } from "../utils.js"

const primitiveColumnTypes = {
	integer: "BIGINT",
	float: "DOUBLE PRECISION",
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

const getPropertyColumn = (property: Property) => `'${property.name}' ${getPropertyColumnType(property)}`

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

	public static async initialize(client: pg.Client, model: Model) {
		let primaryKeyIndex: number | null = null
		let primaryKey: PrimaryKeyProperty | null = null
		let columns: string[] = []
		let columnNames: `"${string}"`[] = []
		let relations: Record<string, RelationAPI> = {}
		let primaryKeyName: string | null

		for (const [i, property] of model.properties.entries()) {
			if (property.kind === "primary" || property.kind === "primitive" || property.kind === "reference") {
				columns.push(getPropertyColumn(property))
				columnNames.push(`"${property.name}"`)

				if (property.kind === "primary") {
					primaryKeyIndex = i
					primaryKey = property
				}
			} else if (property.kind === "relation") {
				relations[property.name] = await RelationAPI.initialize(client, {
					source: model.name,
					property: property.name,
					target: property.target,
					indexed: false,
				})
			} else {
				signalInvalidType(property)
			}
		}

		assert(primaryKey !== null, "expected primaryKey !== null")
		assert(primaryKeyIndex !== null, "expected primaryKeyIndex !== null")
		// primaryKeyName = columnNames[primaryKeyIndex]
		primaryKeyName = primaryKey.name

		const api = new ModelAPI(client, model, columns, columnNames, relations, primaryKeyName)

		// Create record table
		await client.query(`CREATE TABLE IF NOT EXISTS "${api.#table}" (${api.#columns.join(", ")})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = `${model.name}/${index.join("/")}`
			const indexColumns = index.map((name) => `'${name}'`)
			await client.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${api.#table}" (${indexColumns.join(", ")})`)
		}

		return api
	}

	public async get(key: string): Promise<ModelValue | null> {
		const record = await this.client.query(
			`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`,
			[key],
		)

		if (record === null) {
			return null
		}

		return {
			...decodeRecord(this.model, record.rows[0]),
			// ...mapValues(this.#relations, (api) => api.get(key)),
			// TODO 4
		}
	}

	public async set(value: ModelValue) {
		validateModelValue(this.model, value)
		const key = value[this.#primaryKeyName]
		assert(typeof key === "string", 'expected typeof primaryKey === "string"')

		// encodeRecordParams
		const values: Array<string | number | boolean | Buffer | null> = []
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
				assert(Array.isArray(value[property.name])) // ?
				continue
			} else {
				signalInvalidType(property)
			}
		}

		const existingRecord = await this.client.query(
			`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`,
			[key],
		)

		if (existingRecord === null) {
			const insertNames = this.#columnNames.join(", ")
			const insertParams = this.#columnNames.map((name: string, i: number) => `$${i + 1}`)
			await this.client.query<{}, any[]>(
				`INSERT OR IGNORE INTO "${this.#table}" (${insertNames}) VALUES (${insertParams})`,
				values,
			)
		} else {
			const updateParams = this.#columnNames.map((name: string, i: number) => `$${i + 1}`)
			const updateEntries = zip(this.#columnNames, updateParams).map(([name, param]) => `${name} = ${param}`)

			await this.client.query<{}, any[]>(
				`UPDATE "${this.#table}" SET ${updateEntries.join(", ")} WHERE "${this.#primaryKeyName}" = $${updateParams.length + 1}`,
				values.concat([key]),
			)
		}

		for (const [name, relation] of Object.entries(this.#relations)) {
			if (existingRecord !== null) {
				relation.delete(key)
			}

			relation.add(key, value[name])
		}
	}

	public async delete(key: string) {
		await this.client.query(`DELETE FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`, [key])

		for (const relation of Object.values(this.#relations)) {
			relation.delete(key)
		}
	}

	public async count(): Promise<number> {
		const results = await this.client.query(`SELECT COUNT(*) AS count FROM "${this.#table}"`)
		return results.rows[0].count ?? 0
	}

	public async *values(): AsyncIterable<ModelValue> {
		// TODO: use iterable query
		const { rows } = await this.client.query(`SELECT ${this.#columnNames.join(", ")} FROM "${this.#table}"`)

		for (const row of rows) {
			const key = row[this.#primaryKeyName]
			assert(typeof key === "string", 'expected typeof key === "string"')
			const value = {
				...decodeRecord(this.model, row),
				// ...mapValues(this.#relations, (api) => api.get(key)),
				// TODO 3
			}

			yield value
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
			assert(
				property.kind === "primary" || property.kind === "primitive" || property.kind === "reference",
				"cannot order by relation properties",
			)

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
			sql.push(`LIMIT :${params.length + 1}`)
			params.push(query.limit)
		}

		// OFFSET
		if (typeof query.offset === "number") {
			sql.push(`LIMIT :${params.length + 1}`)
			params.push(query.offset)
		}

		assert(typeof query.select !== "undefined", "modelDB.query must be a SELECT")
		const results = await this.client.query<typeof query.select, any[]>(sql.join(" "), params)
		const finalResults = []

		for (const record of results.rows) {
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

			for (const relation of relations) {
				value[relation.property] = await this.#relations[relation.property].get(key)
			}

			finalResults.push(value)
		}
		return finalResults
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

	private getWhereExpression(
		where: WhereCondition = {},
	): [where: string | null, params: Array<null | number | string | Buffer | boolean>] {
		const params: Array<null | number | string | Buffer | boolean> = []

		let i = 0
		const filters = Object.entries(where).flatMap(([name, expression]) => {
			const property = this.#properties[name]
			assert(property !== undefined, "property not found")

			if (property.kind === "primary") {
				if (isLiteralExpression(expression)) {
					if (typeof expression !== "string") {
						throw new TypeError("invalid primary key value (expected string)")
					}

					const p = ++i
					params[p] = expression
					return [`"${name}" = $${p}`]
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (typeof value !== "string") {
						throw new TypeError("invalid primary key value (expected string)")
					}

					const p = ++i
					params[p] = value
					return [`"${name}" != $${p}`]
				} else if (isRangeExpression(expression)) {
					const keys = Object.keys(expression) as (keyof RangeExpression)[]
					return keys.flatMap((key, j) => {
						const value = expression[key]
						if (typeof value !== "string") {
							throw new TypeError("invalid primary key value (expected string)")
						}

						const p = ++i
						params[p] = value
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
					if (expression === null) {
						return [`"${name}" ISNULL`]
					} else if (Array.isArray(expression)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					} else {
						const p = ++i
						params[p] = expression instanceof Uint8Array ? Buffer.from(expression) : expression
						return [`"${name}" = $${p}`]
					}
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (value === null) {
						return [`"${name}" NOTNULL`]
					} else if (Array.isArray(value)) {
						throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
					} else {
						const p = ++i
						params[p] = value instanceof Uint8Array ? Buffer.from(value) : value
						if (property.optional) {
							return [`("${name}" ISNULL OR "${name}" != $${p})`]
						} else {
							return [`"${name}" != $${p}`]
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

						const p = ++i
						params[p] = value instanceof Uint8Array ? Buffer.from(value) : value
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
						params[p] = reference
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
						params[p] = reference
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
						params[p] = reference
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
						params[p] = reference
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

	public static async initialize(client: pg.Client, relation: Relation) {
		// Initialize tables
		const relationApi = new RelationAPI(client, relation)
		const columns = [`_source TEXT NOT NULL`, `_target TEXT NOT NULL`]

		await client.query(`CREATE TABLE IF NOT EXISTS "${relationApi.table}" (${columns.join(", ")})`)
		await client.query(`CREATE INDEX IF NOT EXISTS "${relationApi.sourceIndex}" ON "${relationApi.table}" (_source)`)
		if (relation.indexed) {
			await client.query(`CREATE INDEX IF NOT EXISTS "${relationApi.targetIndex}" ON "${relationApi.table}" (_target)`)
		}

		return relationApi
	}

	public constructor(
		readonly client: pg.Client,
		readonly relation: Relation,
	) {
		this.client = client
	}

	public async get(source: string): Promise<string[]> {
		const results = await this.client.query<{ _target: string }>(
			`SELECT _target FROM "${this.table}" WHERE _source = :$1`,
			[source],
		)
		return results.rows.map((result) => result._target)
	}

	public async add(source: string, targets: PropertyValue) {
		assert(Array.isArray(targets), "expected string[]")
		for (const target of targets) {
			assert(typeof target === "string", "expected string[]")
			await this.client.query(`INSERT INTO "${this.table}" (_source, _target) VALUES ($1, $2)`, [source, target])
		}
	}

	public async delete(source: string) {
		await this.client.query(`DELETE FROM "${this.table}" WHERE _source = $1`, [source])
	}
}
