import pg from "pg"

import { assert, signalInvalidType, mapValues, zip } from "@canvas-js/utils"

import {
	Property,
	Relation,
	Model,
	ModelValue,
	PrimitiveType,
	QueryParams,
	WhereCondition,
	PrimitiveProperty,
	Config,
	PrimaryKeyValue,
	PropertyAPI,
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	validateModelValue,
	isPrimaryKey,
	equalPrimaryKeys,
	equalReferences,
} from "@canvas-js/modeldb"

import { RelationAPI } from "./RelationAPI.js"
import { PostgresPrimitiveValue, Encoder, Decoder, columnTypes } from "./encoding.js"
import { Method, Query, quote } from "./utils.js"

function getColumn(name: string, type: PrimitiveType, nullable: boolean) {
	if (nullable) {
		return `"${name}" ${columnTypes[type]}`
	} else {
		return `"${name}" ${columnTypes[type]} NOT NULL`
	}
}

export class ModelAPI {
	public static async create(client: pg.Client, config: Config, model: Model, clear: boolean = false) {
		/** SQL column declarations */
		const columns: string[] = []

		/** unquoted column names for non-relation properties */
		const columnNames: string[] = []

		const properties = Object.fromEntries(model.properties.map((property) => [property.name, property]))
		const relations: Record<string, RelationAPI> = {}
		const primaryProperties: PrimitiveProperty[] = config.primaryKeys[model.name]
		const mutableProperties: Property[] = []
		const codecs: Record<string, PropertyAPI<PostgresPrimitiveValue>> = {}

		for (const property of model.properties) {
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				columns.push(getColumn(name, type, nullable))
				columnNames.push(name)

				const propertyName = `${model.name}/${name}`
				codecs[property.name] = {
					columns: [property.name],
					encode: (value) => [Encoder.encodePrimitiveValue(propertyName, type, nullable, value)],
					decode: (record) => Decoder.decodePrimitiveValue(propertyName, type, nullable, record[property.name]),
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
					columns.push(getColumn(property.name, targetProperty.type, property.nullable))
					columnNames.push(property.name)

					codecs[property.name] = {
						columns: [property.name],
						encode: (value) => Encoder.encodeReferenceValue(propertyName, [targetProperty], property.nullable, value),
						decode: (record) =>
							Decoder.decodeReferenceValue(propertyName, property.nullable, [targetProperty], [record[property.name]]),
					}
				} else {
					const refNames: string[] = []

					for (const targetProperty of config.primaryKeys[target.name]) {
						const refName = `${property.name}/${targetProperty.name}`
						columns.push(getColumn(refName, targetProperty.type, property.nullable))
						columnNames.push(refName)
						refNames.push(refName)
					}

					codecs[property.name] = {
						columns: refNames,

						encode: (value) =>
							Encoder.encodeReferenceValue(propertyName, config.primaryKeys[target.name], property.nullable, value),

						decode: (record) =>
							Decoder.decodeReferenceValue(
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
				relations[property.name] = await RelationAPI.create(client, config, relation, clear)

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
			queries.push(`DROP TABLE IF EXISTS "${api.table}"`)
		}

		const primaryKeyConstraint = `PRIMARY KEY (${model.primaryKey.map(quote).join(", ")})`
		const tableSchema = [...columns, primaryKeyConstraint].join(", ")
		queries.push(`CREATE TABLE IF NOT EXISTS "${api.table}" (${tableSchema})`)

		// Create indexes
		for (const index of model.indexes) {
			if (index.length === 1 && index[0] in relations) {
				continue
			}

			const indexName = [model.name, ...index].join("/")
			const indexColumnNames = index.flatMap((name) => codecs[name].columns)
			const indexColumns = indexColumnNames.map(quote).join(", ")
			queries.push(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${api.table}" (${indexColumns})`)
		}

		await client.query(queries.join("; "))

		return api
	}

	readonly table: string

	// Methods
	readonly #insert: Method
	readonly #update: Method | null
	readonly #delete: Method
	readonly #clear: Method

	// Queries
	readonly #select: Query
	readonly #selectAll: Query
	readonly #selectMany: Query
	readonly #count: Query<{ count: number }>

	readonly codecNames: string[]
	readonly relationNames: string[]

	constructor(
		readonly client: pg.Client,
		readonly config: Config,
		readonly model: Model,
		readonly properties: Record<string, Property>,
		readonly relations: Record<string, RelationAPI>,
		readonly primaryProperties: PrimitiveProperty[],
		readonly mutableProperties: Property[],
		readonly codecs: Record<string, PropertyAPI<PostgresPrimitiveValue>>,
		columnNames: string[],
	) {
		this.table = model.name
		this.codecNames = Object.keys(this.codecs)
		this.relationNames = Object.keys(this.relations)

		const quotedColumnNames = columnNames.map(quote).join(", ")

		const insertParams = Array.from({ length: columnNames.length })
			.map((_, i) => `$${i + 1}`)
			.join(", ")

		this.#insert = new Method(
			client,
			`INSERT INTO "${this.table}" (${quotedColumnNames}) VALUES (${insertParams}) ON CONFLICT DO NOTHING`,
		)

		const updateNames = columnNames.filter((name) => !model.primaryKey.includes(name))
		if (updateNames.length > 0) {
			const updateEntries = updateNames.map((name, i) => `"${name}" = $${i + 1}`)
			const updateWhere = model.primaryKey
				.map((name, i) => `"${name}" = $${updateEntries.length + i + 1}`)
				.join(" AND ")

			this.#update = new Method(client, `UPDATE "${this.table}" SET ${updateEntries.join(", ")} WHERE ${updateWhere}`)
		} else {
			this.#update = null
		}

		const deleteWhere = model.primaryKey.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")
		this.#delete = new Method(client, `DELETE FROM "${this.table}" WHERE ${deleteWhere}`)
		this.#clear = new Method(client, `DELETE FROM "${this.table}"`)

		// Prepare queries
		this.#count = new Query<{ count: number }>(this.client, `SELECT COUNT(*) AS count FROM "${this.table}"`)

		const selectWhere = model.primaryKey.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")
		const selectColumnNames = model.properties
			.flatMap((property) => {
				// if (model.primaryKey.includes(property.name)) {
				// 	return []
				// }

				if (property.kind === "primitive") {
					if (property.type === "json") {
						return [`"${property.name}"::jsonb`]
					} else {
						return [quote(property.name)]
					}
				} else if (property.kind === "reference") {
					return this.codecs[property.name].columns.map(quote)
				} else if (property.kind === "relation") {
					return []
				} else {
					signalInvalidType(property)
				}
			})
			.join(", ")

		this.#select = new Query(this.client, `SELECT ${selectColumnNames} FROM "${this.table}" WHERE ${selectWhere}`)

		const orderByPrimaryKey = model.primaryKey.map((name) => `"${name}" ASC`).join(", ")
		this.#selectAll = new Query(
			this.client,
			`SELECT ${selectColumnNames} FROM "${this.table}" ORDER BY ${orderByPrimaryKey}`,
		)

		const unnest = this.primaryProperties
			.map(({ type }, i) => `$${i + 1}::${columnTypes[type].toLowerCase()}[]`)
			.join(", ")

		const match = model.primaryKey.map((name) => `"/table"."${name}" = "/keys"."${name}"`).join(" AND ")
		const primaryKeyNames = model.primaryKey.map(quote).join(", ")
		this.#selectMany = new Query(
			this.client,
			`
			WITH "/keys" AS (
			  SELECT ${primaryKeyNames}, "/index"::integer
				FROM unnest(${unnest})
				WITH ORDINALITY AS t(${primaryKeyNames}, "/index")
			)
			SELECT "/keys"."/index", "/table".* FROM "/keys"
			  LEFT JOIN "${this.table}" "/table" ON ${match}
			ORDER BY "/keys"."/index"
			`,
		)
	}

	public async drop() {
		const queries: string[] = []
		for (const relationAPI of Object.values(this.relations)) {
			queries.push(`DROP TABLE "${relationAPI.table}";`)
		}

		queries.push(`DROP TABLE "${this.table}";`)
		await this.client.query(queries.join("\n"))
	}

	public async get(key: PrimaryKeyValue | PrimaryKeyValue[]): Promise<ModelValue | null> {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
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
				result[name] = Decoder.decodePrimitiveValue(name, type, nullable, record[name])
			} else if (property.kind === "reference") {
				const { name, nullable, target } = property
				const values = this.codecs[name].columns.map((name) => record[name])
				result[name] = Decoder.decodeReferenceValue(name, nullable, this.config.primaryKeys[target], values)
			} else if (property.kind === "relation") {
				const { name, target } = property
				const targets = await this.relations[name].get(encodedKey)
				result[name] = targets.map((key) =>
					Decoder.decodeReferenceValue(name, false, this.config.primaryKeys[target], key),
				) as PrimaryKeyValue[] | PrimaryKeyValue[][]
			} else {
				signalInvalidType(property)
			}
		}

		return result
	}

	public async getMany(keys: PrimaryKeyValue[] | PrimaryKeyValue[][]): Promise<(ModelValue | null)[]> {
		if (keys.length === 0) {
			return []
		}

		const wrappedKeys = keys.map((key) => {
			const wrappedKey = Array.isArray(key) ? key : [key]
			if (wrappedKey.length !== this.primaryProperties.length) {
				throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
			}

			return wrappedKey
		})

		const encodedKeys = wrappedKeys.map((wrappedKey) =>
			this.primaryProperties.map(({ name, type, nullable }, i) =>
				Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
			),
		)

		const columns = this.primaryProperties.map<PostgresPrimitiveValue[]>(({ name, type, nullable }, i) =>
			wrappedKeys.map<PostgresPrimitiveValue>((wrappedKey) =>
				Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
			),
		)

		const rows = await this.#selectMany.all(columns)
		assert(rows.length === wrappedKeys.length, "internal error - expected rows.length === wrappedKeys.length")

		const results = new Array<ModelValue | null>(wrappedKeys.length).fill(null)

		for (const [wrappedKey, encodedKey, row, i] of zip(wrappedKeys, encodedKeys, rows)) {
			assert(typeof row["/index"] === "number", "expected integer row index")
			const index = row["/index"] - 1
			assert(index < results.length, "internal error - result index out of range")
			assert(index === i, "internal error - expeected index === i")

			if (this.model.primaryKey.every((name) => row[name] === null)) {
				continue
			}

			const result: ModelValue = {}

			for (const [name, wrappedValue, encodedValue] of zip(this.model.primaryKey, wrappedKey, encodedKey)) {
				// isEqualPostgresPrimitiveValue
				if (Buffer.isBuffer(encodedValue) && Buffer.isBuffer(row[name])) {
					assert(encodedValue.equals(row[name]), "internal error - expected matching record")
				} else {
					assert(encodedValue === row[name], "internal error - expected matching record")
				}

				result[name] = wrappedValue
			}

			for (const property of this.mutableProperties) {
				if (property.kind === "primitive") {
					const { name, type, nullable } = property
					result[name] = Decoder.decodePrimitiveValue(name, type, nullable, row[name])
				} else if (property.kind === "reference") {
					const { name, nullable, target } = property
					const values = this.codecs[name].columns.map((name) => row[name])
					result[name] = Decoder.decodeReferenceValue(name, nullable, this.config.primaryKeys[target], values)
				} else if (property.kind === "relation") {
					const { name, target } = property
					const targets = await this.relations[name].get(encodedKey)
					result[name] = targets.map((key) =>
						Decoder.decodeReferenceValue(name, false, this.config.primaryKeys[target], key),
					) as PrimaryKeyValue[] | PrimaryKeyValue[][]
				} else {
					signalInvalidType(property)
				}
			}

			results[index] = result
		}

		return results
	}

	public async getAll(): Promise<ModelValue[]> {
		const rows = await this.#selectAll.all([])
		return Promise.all(rows.map((row) => this.parseRecord(row, this.codecNames, this.relationNames)))
	}

	public async set(value: ModelValue) {
		validateModelValue(this.model, value)

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }) =>
			Encoder.encodePrimitiveValue(name, type, nullable, value[name]),
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
			const encodedTargets = value[name].map((key) => Encoder.encodeReferenceValue(name, target, false, key))

			await relation.add(encodedKey, encodedTargets)
		}
	}

	private encodeProperties(properties: Property[], value: ModelValue): PostgresPrimitiveValue[] {
		const result: PostgresPrimitiveValue[] = []
		for (const property of properties) {
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				result.push(Encoder.encodePrimitiveValue(name, type, nullable, value[name]))
			} else if (property.kind === "reference") {
				const { name, target, nullable } = property
				const targetProperties = this.config.primaryKeys[target]
				result.push(...Encoder.encodeReferenceValue(name, targetProperties, nullable, value[property.name]))
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
			Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
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
		sql.push(`SELECT COUNT(*) AS count FROM "${this.table}"`)

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
		relations: string[],
	): Promise<ModelValue> {
		const record: ModelValue = {}
		for (const name of properties) {
			record[name] = this.codecs[name].decode(row)
		}

		for (const name of relations) {
			const api = this.relations[name]
			const { sourceProperty, target } = api.relation
			const encodedKey = this.primaryProperties.map(({ name }) => {
				assert(row[name] !== undefined, "cannot select relation properties without selecting the primary key")
				return row[name]
			})

			const targetKeys = await this.relations[sourceProperty].get(encodedKey)
			const targetPrimaryKey = this.config.primaryKeys[target]
			record[sourceProperty] = targetKeys.map((targetKey) =>
				Decoder.decodeReferenceValue(sourceProperty, false, targetPrimaryKey, targetKey),
			) as PrimaryKeyValue[] | PrimaryKeyValue[][]
		}

		return record
	}

	private parseQuery(
		query: QueryParams,
	): [sql: string, properties: string[], relations: string[], params: PostgresPrimitiveValue[]] {
		// See https://www.sqlite.org/lang_select.html for railroad diagram
		const sql: string[] = []
		const params: PostgresPrimitiveValue[] = []

		// SELECT
		const select = query.select ?? mapValues(this.properties, () => true)
		const [selectExpression, selectProperties, selectRelations] = this.getSelectExpression(select)
		sql.push(`SELECT ${selectExpression} FROM "${this.table}"`)

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
				assert(name in this.properties, "invalid orderBy index")
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
	): [selectExpression: string, properties: string[], relations: string[]] {
		const properties: string[] = []
		const relations: string[] = []
		const columns = []

		for (const [name, value] of Object.entries(select)) {
			if (value === false) {
				continue
			}

			const property = this.properties[name]
			assert(property !== undefined, "property not found")
			if (property.kind === "primitive" || property.kind === "reference") {
				properties.push(name)
				columns.push(...this.codecs[name].columns.map(quote))
			} else if (property.kind === "relation") {
				relations.push(name)
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

					const encodedValue = Encoder.encodePrimitiveValue(name, type, false, expression)
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

					const encodedValue = Encoder.encodePrimitiveValue(name, type, false, value)
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
							const idx = params.push(Encoder.encodePrimitiveValue(name, type, nullable, value))
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
					const encodedKey = Encoder.encodeReferenceValue(name, target, true, expression)
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

					const encodedKey = Encoder.encodeReferenceValue(name, target, true, expression.neq)

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
						const wrappedKey = Encoder.encodeReferenceValue(property.name, targetPrimaryProperties, false, target)
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
						const wrappedKey = Encoder.encodeReferenceValue(property.name, targetPrimaryProperties, false, target)
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
}
