import pg from "pg"

import { assert, signalInvalidType, mapValues } from "@canvas-js/utils"

import {
	Property,
	Relation,
	Model,
	ModelValue,
	PrimitiveType,
	QueryParams,
	WhereCondition,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	validateModelValue,
	PrimitiveProperty,
	Config,
	PrimaryKeyValue,
	PropertyValue,
} from "@canvas-js/modeldb"

import {
	PostgresPrimitiveValue,
	encodePrimitiveValue,
	encodeReferenceValue,
	decodePrimitiveValue,
	decodeReferenceValue,
} from "./encoding.js"
import { Method, Query } from "./utils.js"

const columnTypes = {
	integer: "BIGINT",
	float: "DOUBLE PRECISION",
	number: "DOUBLE PRECISION",
	string: "TEXT",
	bytes: "BYTEA",
	boolean: "BOOLEAN",
	json: "JSONB",
} satisfies Record<PrimitiveType, string>

function getColumn(name: string, type: PrimitiveType, nullable: boolean) {
	if (nullable) {
		return `"${name}" ${columnTypes[type]}`
	} else {
		return `"${name}" ${columnTypes[type]} NOT NULL`
	}
}

const quote = (name: string) => `"${name}"`

export class ModelAPI {
	public static async initialize(client: pg.Client, config: Config, model: Model, clear: boolean = false) {
		/** SQL column declarations */
		const columns: string[] = []

		/** unquoted column names for non-relation properties */
		const columnNames: string[] = []

		const properties = Object.fromEntries(model.properties.map((property) => [property.name, property]))
		const relations: Record<string, RelationAPI> = {}

		const codecs: Record<
			string,
			{
				columns: string[]
				encode: (value: PropertyValue) => PostgresPrimitiveValue[]
				decode: (record: Record<string, PostgresPrimitiveValue>) => PropertyValue
			}
		> = {}

		const primaryProperties: PrimitiveProperty[] = config.primaryKeys[model.name]
		const mutableProperties: Property[] = []

		for (const property of model.properties) {
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				columns.push(getColumn(name, type, nullable))
				columnNames.push(name)

				const propertyName = `${model.name}/${name}`
				codecs[property.name] = {
					columns: [property.name],
					encode: (value) => [encodePrimitiveValue(propertyName, type, nullable, value)],
					decode: (record) => decodePrimitiveValue(propertyName, type, nullable, record[property.name]),
				}

				if (!model.primaryKey.includes(property.name)) {
					mutableProperties.push(property)
				}
			} else if (property.kind === "reference") {
				const propertyName = `${model.name}/${property.name}`

				const target = config.models.find((model) => model.name === property.target)
				assert(target !== undefined)

				config.primaryKeys[target.name]

				if (target.primaryKey.length === 1) {
					const [targetProperty] = config.primaryKeys[target.name]
					columns.push(getColumn(property.name, targetProperty.type, false))
					columnNames.push(property.name)

					codecs[property.name] = {
						columns: [property.name],
						encode: (value) => encodeReferenceValue(propertyName, [targetProperty], property.nullable, value),
						decode: (record) =>
							decodeReferenceValue(propertyName, property.nullable, [targetProperty], [record[property.name]]),
					}
				} else {
					const refNames: string[] = []

					for (const targetProperty of config.primaryKeys[target.name]) {
						const refName = `${property.name}/${targetProperty.name}`
						columns.push(getColumn(refName, targetProperty.type, false))
						columnNames.push(refName)
						refNames.push(refName)
					}

					codecs[property.name] = {
						columns: refNames,

						encode: (value) =>
							encodeReferenceValue(propertyName, config.primaryKeys[target.name], property.nullable, value),

						decode: (record) =>
							decodeReferenceValue(
								propertyName,
								property.nullable,
								config.primaryKeys[target.name],
								refNames.map((name) => record[name]),
							),
					}
				}

				mutableProperties.push(property)
			} else if (property.kind === "relation") {
				const relation = config.relations.find(
					(relation) => relation.source === model.name && relation.sourceProperty === property.name,
				)
				assert(relation !== undefined, "internal error - relation not found")
				relations[property.name] = await RelationAPI.initialize(client, config, relation, clear)

				mutableProperties.push(property)
			} else {
				signalInvalidType(property)
			}
		}

		const api = new ModelAPI(
			client,
			config,
			model,
			properties,
			relations,
			primaryProperties,
			mutableProperties,
			codecs,
			columnNames,
		)

		const queries: string[] = []

		// Create record table

		if (clear) {
			queries.push(`DROP TABLE IF EXISTS "${api.#table}"`)
		}

		const primaryKeyConstraint = `PRIMARY KEY (${model.primaryKey.map(quote).join(", ")})`
		const tableSchema = [...columns, primaryKeyConstraint].join(", ")
		queries.push(`CREATE TABLE IF NOT EXISTS "${api.#table}" (${tableSchema})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = [model.name, ...index].join("/")
			const indexColumns = index.map(quote).join(", ")
			queries.push(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${api.#table}" (${indexColumns})`)
		}

		await client.query(queries.join("; "))

		return api
	}

	readonly #table: string

	// Methods
	readonly #insert: Method
	readonly #update: Method | null
	readonly #delete: Method
	readonly #clear: Method

	// Queries
	readonly #select: Query
	readonly #selectAll: Query
	// readonly #selectMany: Query
	readonly #count: Query<{ count: number }>

	constructor(
		readonly client: pg.Client,
		readonly config: Config,
		readonly model: Model,
		readonly properties: Record<string, Property>,
		readonly relations: Record<string, RelationAPI>,
		readonly primaryProperties: PrimitiveProperty[],
		readonly mutableProperties: Property[],
		readonly codecs: Record<
			string,
			{
				columns: string[]
				encode: (value: PropertyValue) => PostgresPrimitiveValue[]
				decode: (record: Record<string, PostgresPrimitiveValue>) => PropertyValue
			}
		>,

		columnNames: string[],
	) {
		this.#table = model.name

		const quotedColumnNames = columnNames.map(quote).join(", ")

		const insertParams = Array.from({ length: columnNames.length })
			.map((_, i) => `$${i + 1}`)
			.join(", ")

		this.#insert = new Method(
			client,
			`INSERT INTO "${this.#table}" (${quotedColumnNames}) VALUES (${insertParams}) ON CONFLICT DO NOTHING`,
		)

		const updateNames = columnNames.filter((name) => !model.primaryKey.includes(name))
		if (updateNames.length > 0) {
			const updateEntries = updateNames.map((name, i) => `"${name}" = $${i + 1}`)
			const updateWhere = model.primaryKey
				.map((name, i) => `"${name}" = $${updateEntries.length + i + 1}`)
				.join(" AND ")

			this.#update = new Method(client, `UPDATE "${this.#table}" SET ${updateEntries.join(", ")} WHERE ${updateWhere}`)
		} else {
			this.#update = null
		}

		const deleteWhere = model.primaryKey.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")
		this.#delete = new Method(client, `DELETE FROM "${this.#table}" WHERE ${deleteWhere}`)
		this.#clear = new Method(client, `DELETE FROM "${this.#table}"`)

		// Prepare queries
		this.#count = new Query<{ count: number }>(this.client, `SELECT COUNT(*) AS count FROM "${this.#table}"`)

		const selectWhere = model.primaryKey.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")
		this.#select = new Query(this.client, `SELECT ${quotedColumnNames} FROM "${this.#table}" WHERE ${selectWhere}`)
		this.#selectAll = new Query(this.client, `SELECT ${quotedColumnNames} FROM "${this.#table}"`)
		// this.#selectMany = new QUery(this.client, `SELECT ${selectColumns} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = ANY($1)`)

		// const updateParams = columnNames.map((name: string, i: number) => `$${i + 1}`)
		// const updateEntries = Array.from(zip(columnNames, updateParams)).map(([name, param]) => `${name} = ${param}`)
		// const updateWhere = `"${this.#primaryKeyName}" = $${updateParams.length + 1}`
		// this.#update = `UPDATE "${this.#table}" SET ${updateEntries.join(", ")} WHERE ${updateWhere}`

		// const selectColumns = this.#columnNames.join(", ")
		// this.#select = `SELECT ${selectColumns} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = $1`
		// this.#selectMany = `SELECT ${selectColumns} FROM "${this.#table}" WHERE "${this.#primaryKeyName}" = ANY($1)`
	}

	public async get(key: PrimaryKeyValue | PrimaryKeyValue[]): Promise<ModelValue | null> {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
		)

		const record = await this.#select.get(encodedKey)
		if (record === null) {
			return null
		}

		const result: ModelValue = Object.fromEntries(
			this.primaryProperties.map((property, i) => [property.name, wrappedKey[i]]),
		)

		for (const property of this.mutableProperties) {
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				result[name] = decodePrimitiveValue(name, type, nullable, record[name])
			} else if (property.kind === "reference") {
				const { name, nullable, target } = property
				const values = this.codecs[name].columns.map((name) => record[name])
				result[name] = decodeReferenceValue(name, nullable, this.config.primaryKeys[target], values)
			} else if (property.kind === "relation") {
				const { name, target } = property
				const targets = await this.relations[name].get(encodedKey)
				result[name] = targets.map((key) => decodeReferenceValue(name, false, this.config.primaryKeys[target], key)) as
					| PrimaryKeyValue[]
					| PrimaryKeyValue[][]
			} else {
				signalInvalidType(property)
			}
		}

		return result
	}

	public async getMany(keys: PrimaryKeyValue[] | PrimaryKeyValue[][]): Promise<(ModelValue | null)[]> {
		return await Promise.all(keys.map((key) => this.get(key)))
	}

	public async set(value: ModelValue) {
		validateModelValue(this.model, value)

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }) =>
			encodePrimitiveValue(name, type, nullable, value[name]),
		)

		const existingRecord = await this.#select.get(encodedKey)

		if (existingRecord === null) {
			const params = this.encodeProperties(this.model.properties, value)
			await this.#insert.run(params)
		} else if (this.#update !== null) {
			const params = this.encodeProperties(this.mutableProperties, value)
			await this.#update.run([...params, ...encodedKey])
		}

		for (const [name, relation] of Object.entries(this.relations)) {
			if (existingRecord !== null) {
				await relation.delete(encodedKey)
			}

			assert(Array.isArray(value[name]))
			const target = this.config.primaryKeys[relation.relation.target]
			const encodedTargets = value[name].map((key) => encodeReferenceValue(name, target, false, key))

			await relation.add(encodedKey, encodedTargets)
		}
	}

	private encodeProperties(properties: Property[], value: ModelValue): PostgresPrimitiveValue[] {
		const result: PostgresPrimitiveValue[] = []
		for (const property of properties) {
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				result.push(encodePrimitiveValue(name, type, nullable, value[name]))
			} else if (property.kind === "reference") {
				const { name, target, nullable } = property
				const targetProperties = this.config.primaryKeys[target]
				result.push(...encodeReferenceValue(name, targetProperties, nullable, value[property.name]))
			} else if (property.kind === "relation") {
				continue
			} else {
				signalInvalidType(property)
			}
		}

		return result
	}

	public async delete(key: PrimaryKeyValue | PrimaryKeyValue[]) {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
		)

		await this.#delete.run(encodedKey)
		for (const relation of Object.values(this.relations)) {
			await relation.delete(encodedKey)
		}
	}

	public async clear() {
		await this.#clear.run([])
		for (const relation of Object.values(this.relations)) {
			await relation.clear()
		}
	}

	public async count(where?: WhereCondition): Promise<number> {
		const sql: string[] = []
		const params: PostgresPrimitiveValue[] = []

		// SELECT
		sql.push(`SELECT COUNT(*) AS count FROM "${this.#table}"`)

		// WHERE
		const whereExpression = this.getWhereExpression(where, params)
		if (whereExpression) {
			sql.push(`WHERE ${whereExpression}`)
		}

		const result = await new Query(this.client, sql.join(" ")).get(params)
		const { count } = result ?? {}
		assert(typeof count === "string", 'expected typeof count === "string"')
		return parseInt(count)
	}

	public async query(query: QueryParams): Promise<ModelValue[]> {
		const [sql, properties, relations, params] = this.parseQuery(query)
		const results: ModelValue[] = []

		for await (const row of new Query(this.client, sql).iterate(params)) {
			const record = await this.parseRecord(row, properties, relations)
			results.push(record)
		}

		return results
	}

	public async *iterate(query: QueryParams): AsyncIterable<ModelValue> {
		const [sql, properties, relations, params] = this.parseQuery(query)

		for await (const row of new Query(this.client, sql).iterate(params)) {
			yield await this.parseRecord(row, properties, relations)
		}
	}

	private async parseRecord(
		row: Record<string, PostgresPrimitiveValue>,
		properties: string[],
		relations: Relation[],
	): Promise<ModelValue> {
		const record: ModelValue = {}
		for (const name of properties) {
			record[name] = this.codecs[name].decode(row)
		}

		for (const relation of relations) {
			const encodedKey = this.config.primaryKeys[this.model.name].map(({ name }) => {
				assert(row[name] !== undefined, "cannot select relation properties without selecting the primary key")
				return row[name]
			})

			const targetKeys = await this.relations[relation.sourceProperty].get(encodedKey)
			const targetPrimaryKey = this.config.primaryKeys[relation.target]
			record[relation.sourceProperty] = targetKeys.map((targetKey) =>
				decodeReferenceValue(relation.sourceProperty, false, targetPrimaryKey, targetKey),
			) as PrimaryKeyValue[] | PrimaryKeyValue[][]
		}

		return record
	}

	private parseQuery(
		query: QueryParams,
	): [sql: string, properties: string[], relations: Relation[], params: PostgresPrimitiveValue[]] {
		// See https://www.sqlite.org/lang_select.html for railroad diagram
		const sql: string[] = []
		const params: PostgresPrimitiveValue[] = []

		// SELECT
		const select = query.select ?? mapValues(this.properties, () => true)
		const [selectExpression, selectProperties, selectRelations] = this.getSelectExpression(select)
		sql.push(`SELECT ${selectExpression} FROM "${this.#table}"`)

		// WHERE
		const where = this.getWhereExpression(query.where, params)
		if (where !== null) {
			sql.push(`WHERE ${where}`)
		}

		// ORDER BY
		if (query.orderBy !== undefined) {
			const orders = Object.entries(query.orderBy)
			assert(orders.length === 1, "cannot order by multiple properties at once")
			const [[indexName, direction]] = orders
			const index = indexName.split("/")

			for (const name of index) {
				if (this.properties[name].kind === "relation") {
					throw new Error("cannot order by relation properties")
				}
			}

			if (direction === "asc") {
				const columns = index.flatMap((name) => this.codecs[name].columns)
				sql.push(`ORDER BY ${columns.map((name) => `"${name}" ASC NULLS FIRST`).join(", ")}`)
			} else if (direction === "desc") {
				const columns = index.flatMap((name) => this.codecs[name].columns)
				sql.push(`ORDER BY ${columns.map((name) => `"${name}" DESC NULLS LAST`).join(", ")}`)
			} else {
				throw new Error("invalid orderBy direction")
			}
		}

		// LIMIT
		if (typeof query.limit === "number") {
			const idx = params.push(query.limit)
			sql.push(`LIMIT $${idx}`)
		}

		// OFFSET
		if (typeof query.offset === "number") {
			const idx = params.push(query.offset)
			sql.push(`OFFSET $${idx}`)
		}

		// JOIN (not supported)
		if (query.include) {
			throw new Error("cannot use 'include' in queries outside the browser/idb")
		}

		return [sql.join(" "), selectProperties, selectRelations, params]
	}

	private getSelectExpression(
		select: Record<string, boolean>,
	): [selectExpression: string, properties: string[], relations: Relation[]] {
		const properties: string[] = []
		const relations: Relation[] = []
		const columns = []

		for (const [name, value] of Object.entries(select)) {
			if (value === false) {
				continue
			}

			const property = this.properties[name]
			assert(property !== undefined, "property not found")
			if (property.kind === "primitive" || property.kind === "reference") {
				properties.push(property.name)
				columns.push(...this.codecs[name].columns.map(quote))
			} else if (property.kind === "relation") {
				relations.push(this.relations[name].relation)
			} else {
				signalInvalidType(property)
			}
		}

		assert(columns.length > 0, "cannot query an empty select expression")
		return [columns.join(", "), properties, relations]
	}

	private getWhereExpression(where: WhereCondition = {}, params: PostgresPrimitiveValue[]): string | null {
		const filters: string[] = []
		for (const [name, expression] of Object.entries(where)) {
			const property = this.properties[name]
			assert(property !== undefined, "property not found")

			if (expression === undefined) {
				continue
			}

			if (property.kind === "primitive") {
				const { type, nullable } = property
				assert(type !== "json", "json properties are not supported in where clauses")

				if (isLiteralExpression(expression)) {
					if (expression === null) {
						filters.push(`"${name}" ISNULL`)
						continue
					}

					const encodedValue = encodePrimitiveValue(name, type, false, expression)
					const idx = params.push(encodedValue)
					filters.push(`"${name}" = $${idx}`)
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (value === undefined) {
						continue
					} else if (value === null) {
						filters.push(`"${name}" NOTNULL`)
						continue
					}

					const encodedValue = encodePrimitiveValue(name, type, false, value)
					const idx = params.push(encodedValue)
					if (nullable) {
						filters.push(`("${name}" ISNULL OR "${name}" != $${idx})`)
					} else {
						filters.push(`"${name}" != $${idx}`)
					}
				} else if (isRangeExpression(expression)) {
					for (const [key, value] of Object.entries(expression)) {
						if (value === undefined) {
							continue
						}

						if (value === null) {
							if (key === "gt") {
								filters.push(`"${name}" NOTNULL`)
							} else if (key === "gte") {
								continue
							} else if (key === "lt") {
								filters.push("0 = 1")
							} else if (key === "lte") {
								filters.push(`"${name}" ISNULL`)
							} else {
								throw new Error(`invalid range expression "${key}"`)
							}
						} else {
							const idx = params.push(encodePrimitiveValue(name, type, nullable, value))
							if (key === "gt") {
								filters.push(`("${name}" NOTNULL) AND ("${name}" > $${idx})`)
							} else if (key === "gte") {
								filters.push(`("${name}" NOTNULL) AND ("${name}" >= $${idx})`)
							} else if (key === "lt") {
								filters.push(`("${name}" ISNULL) OR ("${name}" < $${idx})`)
							} else if (key === "lte") {
								filters.push(`("${name}" ISNULL) OR ("${name}" <= $${idx})`)
							}
						}
					}
				} else {
					signalInvalidType(expression)
				}
			} else if (property.kind === "reference") {
				const target = this.config.primaryKeys[property.target]
				const { columns } = this.codecs[name]

				if (isLiteralExpression(expression)) {
					const encodedKey = encodeReferenceValue(name, target, true, expression)
					if (encodedKey.every((key) => key === null)) {
						filters.push(columns.map((c) => `"${c}" ISNULL`).join(" AND "))
					} else {
						const baseIdx = params.length + 1
						filters.push(columns.map((c, i) => `"${c}" = $${baseIdx + i}`).join(" AND "))
						params.push(...encodedKey)
					}
				} else if (isNotExpression(expression)) {
					if (expression.neq === undefined) {
						continue
					}

					const encodedKey = encodeReferenceValue(name, target, true, expression.neq)

					if (encodedKey.every((key) => key === null)) {
						filters.push(columns.map((c) => `"${c}" NOTNULL`).join(" AND "))
					} else {
						const baseIdx = params.length + 1
						const isNull = columns.map((c) => `"${c}" ISNULL`).join(" AND ")
						const isNotEq = columns.map((c, i) => `"${c}" != $${baseIdx + i}`).join(" AND ")
						filters.push(`(${isNull}) OR (${isNotEq})`)
						params.push(...encodedKey)
					}
				} else if (isRangeExpression(expression)) {
					// TODO: support range queries on references
					throw new Error("cannot use range expressions on reference values")
				} else {
					signalInvalidType(expression)
				}
			} else if (property.kind === "relation") {
				const relation = this.relations[property.name]
				const primaryColumnNames = this.primaryProperties.map((property) => property.name)
				const targetPrimaryProperties = this.config.primaryKeys[property.target]

				if (isLiteralExpression(expression)) {
					const targets = expression
					assert(Array.isArray(targets), "invalid relation value (expected array of primary keys)")
					for (const target of targets) {
						const wrappedKey = encodeReferenceValue(property.name, targetPrimaryProperties, false, target)
						assert(wrappedKey.length === relation.targetColumnNames.length)

						const primaryColumns = primaryColumnNames.map(quote).join(", ")
						const sourceColumns = relation.sourceColumnNames.map(quote).join(", ")

						const targetExpressions = relation.targetColumnNames
							.map((name, i) => `"${name}" = $${params.push(wrappedKey[i])}`)
							.join(" AND ")

						filters.push(
							`(${primaryColumns}) IN (SELECT ${sourceColumns} FROM "${relation.table}" WHERE (${targetExpressions}))`,
						)
					}
				} else if (isNotExpression(expression)) {
					const targets = expression.neq
					assert(Array.isArray(targets), "invalid relation value (expected array of primary keys)")
					for (const target of targets) {
						const wrappedKey = encodeReferenceValue(property.name, targetPrimaryProperties, false, target)
						assert(wrappedKey.length === relation.targetColumnNames.length)

						const primaryColumns = primaryColumnNames.map(quote).join(", ")
						const sourceColumns = relation.sourceColumnNames.map(quote).join(", ")

						const targetExpressions = relation.targetColumnNames
							.map((name, i) => `"${name}" = $${params.push(wrappedKey[i])}`)
							.join(" AND ")

						filters.push(
							`(${primaryColumns}) NOT IN (SELECT ${sourceColumns} FROM "${relation.table}" WHERE (${targetExpressions}))`,
						)
					}
				} else if (isRangeExpression(expression)) {
					throw new Error("cannot use range expressions on relation values")
				} else {
					signalInvalidType(expression)
				}
			} else {
				signalInvalidType(property)
			}
		}

		if (filters.length === 0) {
			return null
		} else {
			return `${filters.map((filter) => `(${filter})`).join(" AND ")}`
		}
	}

	// private getWhereExpression(where: WhereCondition = {}): [where: string | null, params: PrimitiveValue[]] {
	// 	const params: PrimitiveValue[] = []

	// 	let i = 0
	// 	const filters = Object.entries(where).flatMap(([name, expression]) => {
	// 		const property = this.#properties[name]
	// 		assert(property !== undefined, "property not found")

	// 		if (expression === undefined) {
	// 			return []
	// 		}

	// 		if (property.kind === "primitive") {
	// 			assert(property.type !== "json", "json properties are not supported in where clauses")

	// 			if (isLiteralExpression(expression)) {
	// 				assert(isPrimitiveValue(expression))
	// 				if (expression === null) {
	// 					return [`"${name}" ISNULL`]
	// 				} else if (Array.isArray(expression)) {
	// 					throw new Error("invalid primitive value (expected null | number | string | Uint8Array)")
	// 				} else {
	// 					const p = ++i
	// 					params[p - 1] = expression instanceof Uint8Array ? Buffer.from(expression) : expression
	// 					return [`"${name}" = $${p}`]
	// 				}
	// 			} else if (isNotExpression(expression)) {
	// 				const { neq: value } = expression
	// 				if (value === undefined) {
	// 					return []
	// 				} else if (value === null) {
	// 					return [`"${name}" NOTNULL`]
	// 				} else if (Array.isArray(value)) {
	// 					throw new Error("invalid primitive value (expected null | number | string | boolean | Uint8Array)")
	// 				}

	// 				assert(isPrimitiveValue(value))

	// 				const p = ++i
	// 				params[p - 1] = value instanceof Uint8Array ? Buffer.from(value) : value
	// 				if (property.nullable) {
	// 					return [`("${name}" ISNULL OR "${name}" != $${p})`]
	// 				} else {
	// 					return [`"${name}" != $${p}`]
	// 				}
	// 			} else if (isRangeExpression(expression)) {
	// 				const keys = Object.keys(expression) as (keyof RangeExpression)[]

	// 				return keys
	// 					.filter((key) => expression[key] !== undefined)
	// 					.flatMap((key, j) => {
	// 						const value = expression[key] as PrimitiveValue
	// 						if (value === null) {
	// 							switch (key) {
	// 								case "gt":
	// 									return [`"${name}" NOTNULL`]
	// 								case "gte":
	// 									return []
	// 								case "lt":
	// 									return ["0 = 1"]
	// 								case "lte":
	// 									return []
	// 							}
	// 						}

	// 						const p = ++i
	// 						params[p - 1] = value instanceof Uint8Array ? Buffer.from(value) : value
	// 						switch (key) {
	// 							case "gt":
	// 								return [`("${name}" NOTNULL) AND ("${name}" > $${p})`]
	// 							case "gte":
	// 								return [`("${name}" NOTNULL) AND ("${name}" >= $${p})`]
	// 							case "lt":
	// 								return [`("${name}" ISNULL) OR ("${name}" < $${p})`]
	// 							case "lte":
	// 								return [`("${name}" ISNULL) OR ("${name}" <= $${p})`]
	// 						}
	// 					})
	// 			} else {
	// 				signalInvalidType(expression)
	// 			}
	// 		} else if (property.kind === "reference") {
	// 			if (isLiteralExpression(expression)) {
	// 				const reference = expression
	// 				if (reference === null) {
	// 					return [`"${name}" ISNULL`]
	// 				} else if (isPrimaryKey(reference)) {
	// 					const p = ++i
	// 					params[p - 1] = reference
	// 					return [`"${name}" = $${p}`]
	// 				} else {
	// 					throw new Error("invalid reference value (expected primary key)")
	// 				}
	// 			} else if (isNotExpression(expression)) {
	// 				const reference = expression.neq
	// 				if (reference === null) {
	// 					return [`"${name}" NOTNULL`]
	// 				} else if (isPrimaryKey(reference)) {
	// 					const p = ++i
	// 					params[p - 1] = reference
	// 					return [`"${name}" != $${p}`]
	// 				} else {
	// 					throw new Error("invalid reference value (expected primary key)")
	// 				}
	// 			} else if (isRangeExpression(expression)) {
	// 				throw new Error("cannot use range expressions on reference values")
	// 			} else {
	// 				signalInvalidType(expression)
	// 			}
	// 		} else if (property.kind === "relation") {
	// const relationTable = this.#relations[property.name].table
	// if (isLiteralExpression(expression)) {
	// 	const references = expression
	// 	assert(Array.isArray(references), "invalid relation value (expected PrimaryKeyValue[])")
	// 	const targets: string[] = []
	// 	for (const [j, reference] of references.entries()) {
	// 		assert(typeof reference === "string", "invalid relation value (expected PrimaryKeyValue[])")
	// 		const p = ++i
	// 		params[p - 1] = reference
	// 		targets.push(
	// 			`"${this.#primaryKeyName}" IN (SELECT _source FROM "${relationTable}" WHERE (_target = $${p}))`,
	// 		)
	// 	}
	// 	return targets.length > 0 ? [targets.join(" AND ")] : []
	// } else if (isNotExpression(expression)) {
	// 	const references = expression.neq
	// 	assert(Array.isArray(references), "invalid relation value (expected PrimaryKeyValue[])")
	// 	const targets: string[] = []
	// 	for (const [j, reference] of references.entries()) {
	// 		assert(typeof reference === "string", "invalid relation value (expected PrimaryKeyValue[])")
	// 		const p = ++i
	// 		params[p - 1] = reference
	// 		targets.push(
	// 			`"${this.#primaryKeyName}" NOT IN (SELECT _source FROM "${relationTable}" WHERE (_target = $${p}))`,
	// 		)
	// 	}
	// 	return targets.length > 0 ? [targets.join(" AND ")] : []
	// } else if (isRangeExpression(expression)) {
	// 	throw new Error("cannot use range expressions on relation values")
	// } else {
	// 	signalInvalidType(expression)
	// }
	// 		} else {
	// 			signalInvalidType(property)
	// 		}
	// 	})

	// 	if (filters.length === 0) {
	// 		return [null, []]
	// 	} else {
	// 		return [`${filters.map((filter) => `(${filter})`).join(" AND ")}`, params]
	// 	}
	// }
}

export class RelationAPI {
	public readonly table: string

	readonly #select: Query
	readonly #insert: Method
	readonly #delete: Method
	readonly #clear: Method

	public static async initialize(client: pg.Client, config: Config, relation: Relation, clear: boolean) {
		const sourceColumnNames: string[] = []
		const targetColumnNames: string[] = []

		const sourcePrimaryKey = config.primaryKeys[relation.source]
		const targetPrimaryKey = config.primaryKeys[relation.target]

		const columns: string[] = []

		if (sourcePrimaryKey.length === 1) {
			const [{ type }] = sourcePrimaryKey
			columns.push(`_source ${columnTypes[type]} NOT NULL`)
			sourceColumnNames.push("_source")
		} else {
			for (const [i, { type }] of sourcePrimaryKey.entries()) {
				const columnName = `_source/${i}`
				columns.push(`"${columnName}" ${columnTypes[type]} NOT NULL`)
				sourceColumnNames.push(columnName)
			}
		}

		if (targetPrimaryKey.length === 1) {
			const [{ type }] = targetPrimaryKey
			columns.push(`_target ${columnTypes[type]} NOT NULL`)
			targetColumnNames.push("_target")
		} else {
			for (const [i, { type }] of targetPrimaryKey.entries()) {
				const columnName = `_target/${i}`
				columns.push(`"${columnName}" ${columnTypes[type]} NOT NULL`)
				targetColumnNames.push(columnName)
			}
		}

		// Initialize tables
		const api = new RelationAPI(client, config, relation, sourceColumnNames, targetColumnNames)

		const queries = []

		if (clear) {
			queries.push(`DROP TABLE IF EXISTS "${api.table}"`)
		}

		const sourceIndex = `${relation.source}/${relation.sourceProperty}/source`
		const targetIndex = `${relation.source}/${relation.sourceProperty}/target`
		const sourceColumns = sourceColumnNames.map(quote).join(", ")
		const targetColumns = targetColumnNames.map(quote).join(", ")

		queries.push(`CREATE TABLE IF NOT EXISTS "${api.table}" (${columns.join(", ")})`)
		queries.push(`CREATE INDEX IF NOT EXISTS "${sourceIndex}" ON "${api.table}" (${sourceColumns})`)
		if (relation.indexed) {
			queries.push(`CREATE INDEX IF NOT EXISTS "${targetIndex}" ON "${api.table}" (${targetColumns})`)
		}

		await client.query(queries.join(";\n"))

		return api
	}

	private constructor(
		readonly client: pg.Client,
		readonly config: Config,
		readonly relation: Relation,
		readonly sourceColumnNames: string[],
		readonly targetColumnNames: string[],
	) {
		this.table = `${relation.source}/${relation.sourceProperty}`

		// Prepare methods
		const insertColumns = [...sourceColumnNames, ...targetColumnNames].map(quote).join(", ")
		const insertParams = Array.from({ length: sourceColumnNames.length + targetColumnNames.length })
			.map((_, i) => `$${i + 1}`)
			.join(", ")
		this.#insert = new Method(client, `INSERT INTO "${this.table}" (${insertColumns}) VALUES (${insertParams})`)

		const selectBySource = sourceColumnNames.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")

		this.#delete = new Method(client, `DELETE FROM "${this.table}" WHERE ${selectBySource}`)
		this.#clear = new Method(client, `DELETE FROM "${this.table}"`)

		// Prepare queries
		const targetColumns = targetColumnNames.map(quote).join(", ")
		this.#select = new Query(client, `SELECT ${targetColumns} FROM "${this.table}" WHERE ${selectBySource}`)

		// this.#insert = `INSERT INTO "${this.table}" (_source, _target) VALUES ($1, $2)`
		// this.#delete = `DELETE FROM "${this.table}" WHERE _source = $1`
		// this.#select = `SELECT _source, _target FROM "${this.table}" WHERE _source = $1`
		// this.#selectMany = `SELECT _source, _target FROM "${this.table}" WHERE _source = ANY($1)`
	}

	public async get(sourceKey: PostgresPrimitiveValue[]): Promise<PostgresPrimitiveValue[][]> {
		const targets = await this.#select.all(sourceKey)
		return targets.map((record) => this.targetColumnNames.map((name) => record[name]))
	}

	public async add(sourceKey: PostgresPrimitiveValue[], targetKeys: PostgresPrimitiveValue[][]) {
		for (const targetKey of targetKeys) {
			await this.#insert.run([...sourceKey, ...targetKey])
		}
	}

	public async delete(sourceKey: PostgresPrimitiveValue[]) {
		await this.#delete.run(sourceKey)
	}

	public async clear() {
		await this.#clear.run([])
	}

	public async getMany(sources: PostgresPrimitiveValue[][]): Promise<PostgresPrimitiveValue[][][]> {
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
}
