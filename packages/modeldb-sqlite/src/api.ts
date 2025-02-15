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
	isNotExpression,
	isLiteralExpression,
	isRangeExpression,
	validateModelValue,
	PrimitiveProperty,
	Config,
	PrimaryKeyValue,
	PropertyValue,
	PropertyAPI,
} from "@canvas-js/modeldb"

import { SqlitePrimitiveValue, Encoder, Decoder } from "./encoding.js"

import { Method, Query } from "./utils.js"

const columnTypes = {
	integer: "INTEGER",
	float: "FLOAT",
	number: "FLOAT",
	string: "TEXT",
	bytes: "BLOB",
	boolean: "INTEGER",
	json: "TEXT",
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
	readonly #table: string

	// Methods
	readonly #insert: Method
	readonly #update: Method | null
	readonly #delete: Method
	readonly #clear: Method<[]>

	// Queries
	readonly #selectAll: Query<[]>
	readonly #select: Query
	readonly #count: Query<[], { count: number }>

	readonly properties: Record<string, Property>
	readonly relations: Record<string, RelationAPI>
	readonly relationNames: string[]
	readonly primaryProperties: PrimitiveProperty[]
	readonly mutableProperties: Property[]
	readonly codecs: Record<string, PropertyAPI<SqlitePrimitiveValue>> = {}
	readonly codecNames: string[]

	public constructor(readonly db: Database, readonly config: Config, readonly model: Model) {
		this.#table = model.name
		this.properties = Object.fromEntries(model.properties.map((property) => [property.name, property]))
		this.relations = {}
		this.primaryProperties = config.primaryKeys[model.name]
		this.mutableProperties = []

		/** SQL column declarations */
		const columns: string[] = []

		/** unquoted column names for non-relation properties */
		const columnNames: string[] = []

		for (const property of model.properties) {
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				columns.push(getColumn(name, type, nullable))
				columnNames.push(name)

				const propertyName = `${model.name}/${name}`
				this.codecs[property.name] = {
					columns: [property.name],
					encode: (value) => [Encoder.encodePrimitiveValue(propertyName, type, nullable, value)],
					decode: (record) => Decoder.decodePrimitiveValue(propertyName, type, nullable, record[property.name]),
				}

				if (!model.primaryKey.includes(property.name)) {
					this.mutableProperties.push(property)
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

					this.codecs[property.name] = {
						columns: [property.name],
						encode: (value) => Encoder.encodeReferenceValue(propertyName, [targetProperty], property.nullable, value),
						decode: (record) =>
							Decoder.decodeReferenceValue(propertyName, property.nullable, [targetProperty], [record[property.name]]),
					}
				} else {
					const refNames: string[] = []

					for (const targetProperty of config.primaryKeys[target.name]) {
						const refName = `${property.name}/${targetProperty.name}`
						columns.push(getColumn(refName, targetProperty.type, false))
						columnNames.push(refName)
						refNames.push(refName)
					}

					this.codecs[property.name] = {
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

				this.mutableProperties.push(property)
			} else if (property.kind === "relation") {
				const relation = config.relations.find(
					(relation) => relation.source === model.name && relation.sourceProperty === property.name,
				)
				assert(relation !== undefined, "internal error - relation not found")
				this.relations[property.name] = new RelationAPI(db, config, relation)

				this.mutableProperties.push(property)
			} else {
				signalInvalidType(property)
			}
		}

		this.codecNames = Object.keys(this.codecs)
		this.relationNames = Object.keys(this.relations)

		// Create record table
		const primaryKeyConstraint = `PRIMARY KEY (${model.primaryKey.map(quote).join(", ")})`
		const tableSchema = [...columns, primaryKeyConstraint].join(", ")
		db.exec(`CREATE TABLE IF NOT EXISTS "${this.#table}" (${tableSchema})`)

		// Create indexes
		for (const index of model.indexes) {
			const indexName = [model.name, ...index].join("/")
			const indexColumnNames = index.flatMap((name) => this.codecs[name].columns)
			const indexColumns = indexColumnNames.map(quote).join(", ")
			db.exec(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.#table}" (${indexColumns})`)
		}

		// Prepare methods

		const quotedColumnNames = columnNames.map(quote).join(", ")

		const insertParams = Array.from({ length: columnNames.length }).fill("?").join(", ")
		this.#insert = new Method(
			db,
			`INSERT OR IGNORE INTO "${this.#table}" (${quotedColumnNames}) VALUES (${insertParams})`,
		)

		const primaryKeyEquals = model.primaryKey.map((name) => `"${name}" = ?`)
		const wherePrimaryKeyEquals = `WHERE ${primaryKeyEquals.join(" AND ")}`

		const updateNames = columnNames.filter((name) => !model.primaryKey.includes(name))
		if (updateNames.length > 0) {
			const updateEntries = updateNames.map((name) => `"${name}" = ?`)
			this.#update = new Method(db, `UPDATE "${this.#table}" SET ${updateEntries.join(", ")} ${wherePrimaryKeyEquals}`)
		} else {
			this.#update = null
		}

		this.#delete = new Method(db, `DELETE FROM "${this.#table}" ${wherePrimaryKeyEquals}`)
		this.#clear = new Method(db, `DELETE FROM "${this.#table}"`)

		// Prepare queries
		this.#count = new Query<[], { count: number }>(this.db, `SELECT COUNT(*) AS count FROM "${this.#table}"`)
		this.#select = new Query(this.db, `SELECT ${quotedColumnNames} FROM "${this.#table}" ${wherePrimaryKeyEquals}`)
		this.#selectAll = new Query(this.db, `SELECT ${quotedColumnNames} FROM "${this.#table}"`)
	}

	public get(key: PrimaryKeyValue | PrimaryKeyValue[]): ModelValue | null {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
		)

		const record = this.#select.get(encodedKey)
		if (record === null) {
			return null
		}

		const result: ModelValue = Object.fromEntries(
			this.primaryProperties.map((property, i) => [property.name, wrappedKey[i]]),
		)

		for (const property of this.mutableProperties) {
			const propertyName = `${this.model.name}/${property.name}`
			if (property.kind === "primitive") {
				const { name, type, nullable } = property
				result[name] = Decoder.decodePrimitiveValue(propertyName, type, nullable, record[name])
			} else if (property.kind === "reference") {
				const { name, nullable, target } = property
				const values = this.codecs[name].columns.map((name) => record[name])
				result[name] = Decoder.decodeReferenceValue(propertyName, nullable, this.config.primaryKeys[target], values)
			} else if (property.kind === "relation") {
				const { name, target } = property
				const targets = this.relations[name].get(encodedKey)
				result[name] = targets.map((key) =>
					Decoder.decodeReferenceValue(propertyName, false, this.config.primaryKeys[target], key),
				) as PrimaryKeyValue[] | PrimaryKeyValue[][]
			} else {
				signalInvalidType(property)
			}
		}

		return result
	}

	public getAll(): ModelValue[] {
		return this.#selectAll.all([]).map((row) => this.parseRecord(row, this.codecNames, this.relationNames))
	}

	public getMany(keys: PrimaryKeyValue[] | PrimaryKeyValue[][]): (ModelValue | null)[] {
		return keys.map((key) => this.get(key))
	}

	public set(value: ModelValue) {
		validateModelValue(this.model, value)

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }) =>
			Encoder.encodePrimitiveValue(name, type, nullable, value[name]),
		)

		const existingRecord = this.#select.get(encodedKey)
		if (existingRecord === null) {
			const params = this.encodeProperties(this.model.properties, value)
			this.#insert.run(params)
		} else if (this.#update !== null) {
			const params = this.encodeProperties(this.mutableProperties, value)
			this.#update.run([...params, ...encodedKey])
		}

		for (const [name, relation] of Object.entries(this.relations)) {
			if (existingRecord !== null) {
				relation.delete(encodedKey)
			}

			assert(Array.isArray(value[name]))
			const target = this.config.primaryKeys[relation.relation.target]
			const encodedTargets = value[name].map((key) => Encoder.encodeReferenceValue(name, target, false, key))

			relation.add(encodedKey, encodedTargets)
		}
	}

	private encodeProperties(properties: Property[], value: ModelValue): SqlitePrimitiveValue[] {
		const result: SqlitePrimitiveValue[] = []
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

	public delete(key: PrimaryKeyValue | PrimaryKeyValue[]) {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
		)

		this.#delete.run(encodedKey)
		for (const relation of Object.values(this.relations)) {
			relation.delete(encodedKey)
		}
	}

	public clear() {
		this.#clear.run([])
		for (const relation of Object.values(this.relations)) {
			relation.clear()
		}
	}

	public count(where?: WhereCondition): number {
		const sql: string[] = []
		const params: SqlitePrimitiveValue[] = []

		// SELECT
		sql.push(`SELECT COUNT(*) AS count FROM "${this.#table}"`)

		// WHERE
		const [whereExpression, whereParams] = this.getWhereExpression(where)

		if (whereExpression) {
			sql.push(`WHERE ${whereExpression}`)
			params.push(...whereParams)
		}

		const { count } = new Query(this.db, sql.join(" ")).get(params) ?? {}
		assert(typeof count === "number")
		return count
	}

	public query(query: QueryParams): ModelValue[] {
		const [sql, properties, relations, params] = this.parseQuery(query)
		const results: ModelValue[] = []

		for (const row of new Query(this.db, sql).iterate(params)) {
			results.push(this.parseRecord(row, properties, relations))
		}

		return results
	}

	public *iterate(query: QueryParams): Iterable<ModelValue> {
		const [sql, properties, relations, params] = this.parseQuery(query)

		for (const row of new Query(this.db, sql).iterate(params)) {
			yield this.parseRecord(row, properties, relations)
		}
	}

	private parseRecord(
		row: Record<string, SqlitePrimitiveValue>,
		properties: string[] = this.codecNames,
		relations: string[] = this.relationNames,
	): ModelValue {
		const record: ModelValue = {}
		for (const name of properties) {
			record[name] = this.codecs[name].decode(row)
		}

		for (const name of relations) {
			const api = this.relations[name]
			const { sourceProperty, target } = api.relation
			const encodedKey = this.config.primaryKeys[this.model.name].map(({ name }) => {
				assert(row[name] !== undefined, "cannot select relation properties without selecting the primary key")
				return row[name]
			})

			const targetKeys = api.get(encodedKey)
			const targetPrimaryKey = this.config.primaryKeys[target]
			record[sourceProperty] = targetKeys.map((targetKey) =>
				Decoder.decodeReferenceValue(sourceProperty, false, targetPrimaryKey, targetKey),
			) as PrimaryKeyValue[] | PrimaryKeyValue[][]
		}

		return record
	}
	private parseQuery(
		query: QueryParams,
	): [sql: string, properties: string[], relations: string[], params: SqlitePrimitiveValue[]] {
		// See https://www.sqlite.org/lang_select.html for railroad diagram
		const sql: string[] = []
		const params: SqlitePrimitiveValue[] = []

		// SELECT
		const select = query.select ?? mapValues(this.properties, () => true)
		const [selectExpression, selectProperties, selectRelations] = this.getSelectExpression(select)
		sql.push(`SELECT ${selectExpression} FROM "${this.#table}"`)

		// WHERE
		const [where, whereParams] = this.getWhereExpression(query.where)

		if (where !== null) {
			sql.push(`WHERE ${where}`)
			params.push(...whereParams)
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
				sql.push(`ORDER BY ${columns.map((name) => `"${name}" ASC`).join(", ")}`)
			} else if (direction === "desc") {
				const columns = index.flatMap((name) => this.codecs[name].columns)
				sql.push(`ORDER BY ${columns.map((name) => `"${name}" DESC`).join(", ")}`)
			} else {
				throw new Error("invalid orderBy direction")
			}
		}

		// LIMIT
		if (typeof query.limit === "number") {
			sql.push(`LIMIT ?`)
			params.push(query.limit)
		}

		// OFFSET
		if (typeof query.offset === "number") {
			sql.push(`OFFSET ?`)
			params.push(query.offset)
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

	private getWhereExpression(where: WhereCondition = {}): [where: string | null, params: SqlitePrimitiveValue[]] {
		const params: SqlitePrimitiveValue[] = []

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
					params.push(encodedValue)
					filters.push(`"${name}" = ?`)
				} else if (isNotExpression(expression)) {
					const { neq: value } = expression
					if (value === undefined) {
						continue
					} else if (value === null) {
						filters.push(`"${name}" NOTNULL`)
						continue
					}

					const encodedValue = Encoder.encodePrimitiveValue(name, type, false, value)
					params.push(encodedValue)
					if (nullable) {
						filters.push(`("${name}" ISNULL OR "${name}" != ?)`)
					} else {
						filters.push(`"${name}" != ?`)
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
							params.push(Encoder.encodePrimitiveValue(name, type, nullable, value))
							if (key === "gt") {
								filters.push(`("${name}" NOTNULL) AND ("${name}" > ?)`)
							} else if (key === "gte") {
								filters.push(`("${name}" NOTNULL) AND ("${name}" >= ?)`)
							} else if (key === "lt") {
								filters.push(`("${name}" ISNULL) OR ("${name}" < ?)`)
							} else if (key === "lte") {
								filters.push(`("${name}" ISNULL) OR ("${name}" <= ?)`)
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
						filters.push(columns.map((c) => `"${c}" = ?`).join(" AND "))
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
						const isNull = columns.map((c) => `"${c}" ISNULL`).join(" AND ")
						const isNotEq = columns.map((c) => `"${c}" != ?`).join(" AND ")
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
						const targetExpressions = relation.targetColumnNames.map((name, i) => `"${name}" = ?`).join(" AND ")
						filters.push(
							`(${primaryColumns}) IN (SELECT ${sourceColumns} FROM "${relation.table}" WHERE (${targetExpressions}))`,
						)

						params.push(...wrappedKey)
					}
				} else if (isNotExpression(expression)) {
					const targets = expression.neq
					assert(Array.isArray(targets), "invalid relation value (expected array of primary keys)")
					for (const target of targets) {
						const wrappedKey = Encoder.encodeReferenceValue(property.name, targetPrimaryProperties, false, target)
						assert(wrappedKey.length === relation.targetColumnNames.length)

						const primaryColumns = primaryColumnNames.map(quote).join(", ")
						const sourceColumns = relation.sourceColumnNames.map(quote).join(", ")
						const targetExpressions = relation.targetColumnNames.map((name, i) => `"${name}" = ?`).join(" AND ")
						filters.push(
							`(${primaryColumns}) NOT IN (SELECT ${sourceColumns} FROM "${relation.table}" WHERE (${targetExpressions}))`,
						)

						params.push(...wrappedKey)
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
			return [null, []]
		} else {
			return [`${filters.map((filter) => `(${filter})`).join(" AND ")}`, params]
		}
	}
}

export class RelationAPI {
	public readonly table: string
	public readonly sourceIndex: string
	public readonly targetIndex: string

	readonly sourceColumnNames: string[]
	readonly targetColumnNames: string[]

	readonly #select: Query
	readonly #insert: Method
	readonly #delete: Method
	readonly #clear: Method<[]>

	public constructor(readonly db: Database, readonly config: Config, readonly relation: Relation) {
		this.table = `${relation.source}/${relation.sourceProperty}`
		this.sourceIndex = `${relation.source}/${relation.sourceProperty}/source`
		this.targetIndex = `${relation.source}/${relation.sourceProperty}/target`

		this.sourceColumnNames = []
		this.targetColumnNames = []

		const sourcePrimaryKey = config.primaryKeys[relation.source]
		const targetPrimaryKey = config.primaryKeys[relation.target]

		{
			const columns: string[] = []

			if (sourcePrimaryKey.length === 1) {
				const [{ type }] = sourcePrimaryKey
				columns.push(`_source ${columnTypes[type]} NOT NULL`)
				this.sourceColumnNames.push("_source")
			} else {
				for (const [i, { type }] of sourcePrimaryKey.entries()) {
					const columnName = `_source/${i}`
					columns.push(`"${columnName}" ${columnTypes[type]} NOT NULL`)
					this.sourceColumnNames.push(columnName)
				}
			}

			if (targetPrimaryKey.length === 1) {
				const [{ type }] = targetPrimaryKey
				columns.push(`_target ${columnTypes[type]} NOT NULL`)
				this.targetColumnNames.push("_target")
			} else {
				for (const [i, { type }] of targetPrimaryKey.entries()) {
					const columnName = `_target/${i}`
					columns.push(`"${columnName}" ${columnTypes[type]} NOT NULL`)
					this.targetColumnNames.push(columnName)
				}
			}

			db.exec(`CREATE TABLE IF NOT EXISTS "${this.table}" (${columns.join(", ")})`)
		}

		const sourceColumns = this.sourceColumnNames.map(quote).join(", ")
		const targetColumns = this.targetColumnNames.map(quote).join(", ")

		db.exec(`CREATE INDEX IF NOT EXISTS "${this.sourceIndex}" ON "${this.table}" (${sourceColumns})`)

		if (relation.indexed) {
			db.exec(`CREATE INDEX IF NOT EXISTS "${this.targetIndex}" ON "${this.table}" (${targetColumns})`)
		}

		// Prepare methods
		const insertColumns = [...this.sourceColumnNames, ...this.targetColumnNames].map(quote).join(", ")
		const insertParamCount = this.sourceColumnNames.length + this.targetColumnNames.length
		const insertParams = Array.from({ length: insertParamCount }).fill("?").join(", ")
		this.#insert = new Method(this.db, `INSERT INTO "${this.table}" (${insertColumns}) VALUES (${insertParams})`)

		const selectBySource = this.sourceColumnNames.map((name) => `"${name}" = ?`).join(" AND ")

		this.#delete = new Method(this.db, `DELETE FROM "${this.table}" WHERE ${selectBySource}`)
		this.#clear = new Method(this.db, `DELETE FROM "${this.table}"`)

		// Prepare queries
		this.#select = new Query(this.db, `SELECT ${targetColumns} FROM "${this.table}" WHERE ${selectBySource}`)
	}

	public get(sourceKey: SqlitePrimitiveValue[]): SqlitePrimitiveValue[][] {
		const targets = this.#select.all(sourceKey)
		return targets.map((record) => this.targetColumnNames.map((name) => record[name]))
	}

	public add(sourceKey: SqlitePrimitiveValue[], targetKeys: SqlitePrimitiveValue[][]) {
		for (const targetKey of targetKeys) {
			this.#insert.run([...sourceKey, ...targetKey])
		}
	}

	public delete(sourceKey: SqlitePrimitiveValue[]) {
		this.#delete.run(sourceKey)
	}

	public clear() {
		this.#clear.run([])
	}
}
