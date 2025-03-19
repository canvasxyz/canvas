import { SQLiteDatabase } from "expo-sqlite"

import { assert, signalInvalidType, mapValues } from "@canvas-js/utils"

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
} from "@canvas-js/modeldb"

import { RelationAPI } from "./RelationAPI.js"
import { SqlitePrimitiveValue, Encoder, Decoder, columnTypes } from "./encoding.js"
import { Method, Query, quote } from "./utils.js"

function getColumn(name: string, type: PrimitiveType, nullable: boolean) {
	if (nullable) {
		return `"${name}" ${columnTypes[type]}`
	} else {
		return `"${name}" ${columnTypes[type]} NOT NULL`
	}
}

type Statements = {
	// Methods
	insert: Method
	update: Method | null
	delete: Method
	clear: Method<[]>

	// Queries
	selectAll: Query<[]>
	select: Query
	count: Query<[], { count: number }>
}

export class ModelAPI {
	readonly table: string

	#statements: Statements

	readonly properties: Record<string, Property> = {}
	readonly relations: Record<string, RelationAPI> = {}
	readonly relationNames: string[] = []

	readonly primaryProperties: PrimitiveProperty[]
	readonly mutableProperties: Property[]

	readonly codecs: Record<string, PropertyAPI<SqlitePrimitiveValue>> = {}
	readonly codecNames: string[] = []

	public constructor(readonly db: SQLiteDatabase, readonly config: Config, readonly model: Model, clear?: boolean) {
		this.table = model.name
		for (const property of model.properties) {
			this.properties[property.name] = property
		}

		this.primaryProperties = config.primaryKeys[model.name]
		this.mutableProperties = []

		/** SQL column declarations */
		const columnDefinitions: string[] = []

		for (const property of model.properties) {
			this.prepareProperty(property, columnDefinitions, clear)
		}

		// Create record table
		const primaryKeyConstraint = `PRIMARY KEY (${model.primaryKey.map(quote).join(", ")})`
		const tableSchema = [...columnDefinitions, primaryKeyConstraint].join(", ")
		db.execSync(`CREATE TABLE IF NOT EXISTS "${this.table}" (${tableSchema})`)

		// Create indexes
		for (const index of model.indexes) {
			if (index.length === 1 && index[0] in this.relations) {
				continue
			}

			const indexName = [model.name, ...index].join("/")
			const indexColumnNames = index.flatMap((name) => this.codecs[name].columns)
			const indexColumns = indexColumnNames.map(quote).join(", ")
			db.execSync(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.table}" (${indexColumns})`)
		}

		this.#statements = this.prepareStatements()
	}

	private prepareStatements(): Statements {
		const columnNames = Object.values(this.codecs).flatMap((codec) => codec.columns)
		const mutableColumnNames = columnNames.filter((name) => !this.model.primaryKey.includes(name))

		const quotedColumnNames = columnNames.map(quote).join(", ")
		const primaryKeyEquals = this.model.primaryKey.map((name) => `"${name}" = ?`)
		const wherePrimaryKeyEquals = `WHERE ${primaryKeyEquals.join(" AND ")}`

		// Prepare methods
		const insertParams = Array.from({ length: columnNames.length }).fill("?").join(", ")
		const insert = new Method(
			this.db,
			`INSERT OR IGNORE INTO "${this.table}" (${quotedColumnNames}) VALUES (${insertParams})`,
		)

		let update: Method | null = null
		if (mutableColumnNames.length > 0) {
			const updateEntries = mutableColumnNames.map((name) => `"${name}" = ?`)
			update = new Method(this.db, `UPDATE "${this.table}" SET ${updateEntries.join(", ")} ${wherePrimaryKeyEquals}`)
		} else {
			update = null
		}

		const _delete = new Method(this.db, `DELETE FROM "${this.table}" ${wherePrimaryKeyEquals}`)
		const clear = new Method(this.db, `DELETE FROM "${this.table}"`)

		// Prepare queries
		const count = new Query<[], { count: number }>(this.db, `SELECT COUNT(*) AS count FROM "${this.table}"`)
		const select = new Query(this.db, `SELECT ${quotedColumnNames} FROM "${this.table}" ${wherePrimaryKeyEquals}`)

		const orderByPrimaryKey = this.model.primaryKey.map((name) => `"${name}" ASC`).join(", ")
		const selectAll = new Query(
			this.db,
			`SELECT ${quotedColumnNames} FROM "${this.table}" ORDER BY ${orderByPrimaryKey}`,
		)

		return { insert, update, delete: _delete, clear, count, select, selectAll }
	}

	private prepareProperty(property: Property, columnDefinitions: string[], clear?: boolean) {
		if (property.kind === "primitive") {
			const { name, type, nullable } = property
			columnDefinitions.push(getColumn(name, type, nullable))

			const propertyName = `${this.model.name}/${name}`
			this.addCodec(property.name, {
				columns: [property.name],
				encode: (value) => [Encoder.encodePrimitiveValue(propertyName, type, nullable, value)],
				decode: (record) => Decoder.decodePrimitiveValue(propertyName, type, nullable, record[property.name]),
			})

			if (!this.model.primaryKey.includes(property.name)) {
				this.mutableProperties.push(property)
			}
		} else if (property.kind === "reference") {
			const propertyName = `${this.model.name}/${property.name}`

			const target = this.config.models.find((model) => model.name === property.target)
			assert(target !== undefined, "internal error - expected target !== undefined")

			const targetPrimaryProperties = this.config.primaryKeys[target.name]

			if (target.primaryKey.length === 1) {
				const [targetProperty] = targetPrimaryProperties
				columnDefinitions.push(getColumn(property.name, targetProperty.type, property.nullable))

				this.addCodec(property.name, {
					columns: [property.name],
					encode: (value) => Encoder.encodeReferenceValue(propertyName, [targetProperty], property.nullable, value),
					decode: (record) =>
						Decoder.decodeReferenceValue(propertyName, property.nullable, [targetProperty], [record[property.name]]),
				})
			} else {
				const refNames: string[] = []

				for (const targetProperty of targetPrimaryProperties) {
					const refName = `${property.name}/${targetProperty.name}`
					columnDefinitions.push(getColumn(refName, targetProperty.type, property.nullable))
					refNames.push(refName)
				}

				this.addCodec(property.name, {
					columns: refNames,

					encode: (value) =>
						Encoder.encodeReferenceValue(propertyName, targetPrimaryProperties, property.nullable, value),

					decode: (record) =>
						Decoder.decodeReferenceValue(
							propertyName,
							property.nullable,
							targetPrimaryProperties,
							refNames.map((name) => record[name]),
						),
				})
			}

			this.mutableProperties.push(property)
		} else if (property.kind === "relation") {
			const relation = this.config.relations.find(
				(relation) => relation.source === this.model.name && relation.sourceProperty === property.name,
			)
			assert(relation !== undefined, "internal error - relation not found")
			this.addRelation(relation, clear)
			this.mutableProperties.push(property)
		} else {
			signalInvalidType(property)
		}
	}

	public async addProperty(property: Property) {
		/** SQL column declarations */
		const columnDefinitions: string[] = []

		this.prepareProperty(property, columnDefinitions, false)

		const alter = columnDefinitions.map((column) => `ADD COLUMN ${column}`)
		this.db.execSync(`ALTER TABLE "${this.table}" ${alter.join(", ")}`)

		this.#statements = this.prepareStatements()
	}

	public removeProperty(propertyName: string) {
		const property = this.properties[propertyName]
		assert(property !== undefined, "internal error - expected property !== undefined")
		delete this.properties[propertyName]

		const index = this.mutableProperties.indexOf(property)
		assert(index !== -1, "internal error - expected index !== -1")
		this.mutableProperties.splice(index, 1)

		if (property.kind === "primitive" || property.kind === "reference") {
			const codec = this.codecs[propertyName]
			assert(codec !== undefined, "internal error - codec !== undefined")
			const alter = codec.columns.map((column) => `DROP COLUMN "${column}"`)
			this.db.execSync(`ALTER TABLE "${this.table}" ${alter.join(", ")}`)
			this.removeCodec(propertyName)
		} else if (property.kind === "relation") {
			this.removeRelation(propertyName)
		} else {
			signalInvalidType(property)
		}

		this.#statements = this.prepareStatements()
	}

	public addIndex(propertyNames: string[]) {
		if (propertyNames.length === 1 && propertyNames[0] in this.relations) {
			const [propertyName] = propertyNames
			this.relations[propertyName].addTargetIndex()
			return
		}

		for (const name of propertyNames) {
			assert(this.relations[name] === undefined, "cannot index relation properties")
		}

		const indexName = [this.model.name, ...propertyNames].join("/")
		const indexColumnNames = propertyNames.flatMap((name) => this.codecs[name].columns)
		const indexColumns = indexColumnNames.map(quote).join(", ")
		this.db.execSync(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.table}" (${indexColumns})`)
	}

	public removeIndex(propertyNames: string[]) {
		if (propertyNames.length === 1 && propertyNames[0] in this.relations) {
			const [propertyName] = propertyNames
			this.relations[propertyName].removeTargetIndex()
			return
		}

		const indexName = [this.model.name, ...propertyNames].join("/")
		this.db.execSync(`DROP INDEX IF EXISTS "${indexName}"`)
	}

	private addCodec(name: string, codec: PropertyAPI<SqlitePrimitiveValue>) {
		this.codecs[name] = codec
		this.codecNames.push(name)
	}

	private removeCodec(name: string) {
		delete this.codecs[name]
		const index = this.codecNames.indexOf(name)
		assert(index !== -1, "internal error - expected index !== -1")
		this.codecNames.splice(index, 1)
	}

	private addRelation(relation: Relation, clear?: boolean) {
		const relationAPI = new RelationAPI(this.db, this.config, relation, clear)
		this.relations[relation.sourceProperty] = relationAPI
		this.relationNames.push(relation.sourceProperty)
	}

	private removeRelation(propertyName: string) {
		const relationAPI = this.relations[propertyName]
		assert(relationAPI !== undefined, "internal error - expected relationAPI !== undefined")
		delete this.relations[propertyName]

		const index = this.relationNames.indexOf(propertyName)
		assert(index !== -1, "internal error - expected index !== -1")
		this.relationNames.splice(index, 1)

		relationAPI.drop()
	}

	public drop() {
		Object.values(this.relations).forEach((relation) => relation.drop())
		this.db.execSync(`DROP TABLE "${this.table}"`)
	}

	public get(key: PrimaryKeyValue | PrimaryKeyValue[]): ModelValue | null {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
		)

		const record = this.#statements.select.get(encodedKey)
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
		return this.#statements.selectAll.all([]).map((row) => this.parseRecord(row, this.codecNames, this.relationNames))
	}

	public getMany(keys: PrimaryKeyValue[] | PrimaryKeyValue[][]): (ModelValue | null)[] {
		return keys.map((key) => this.get(key))
	}

	public set(value: ModelValue) {
		validateModelValue(this.model, value)

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }) =>
			Encoder.encodePrimitiveValue(name, type, nullable, value[name]),
		)

		const existingRecord = this.#statements.select.get(encodedKey)
		if (existingRecord === null) {
			const params = this.encodeProperties(this.model.properties, value)
			this.#statements.insert.run(params)
		} else if (this.#statements.update !== null) {
			const params = this.encodeProperties(this.mutableProperties, value)
			this.#statements.update.run([...params, ...encodedKey])
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

		this.#statements.delete.run(encodedKey)
		for (const relation of Object.values(this.relations)) {
			relation.delete(encodedKey)
		}
	}

	public clear() {
		this.#statements.clear.run([])
		for (const relation of Object.values(this.relations)) {
			relation.clear()
		}
	}

	public count(where?: WhereCondition): number {
		const sql: string[] = []
		const params: SqlitePrimitiveValue[] = []

		// SELECT
		sql.push(`SELECT COUNT(*) AS count FROM "${this.table}"`)

		// WHERE
		const [whereExpression, whereParams] = this.getWhereExpression(where)

		if (whereExpression) {
			sql.push(`WHERE ${whereExpression}`)
			params.push(...whereParams)
		}

		const stmt = new Query<SqlitePrimitiveValue[], { count: number }>(this.db, sql.join(" "))
		try {
			const result = stmt.get(params)
			assert(result !== null && typeof result.count === "number")
			return result.count
		} finally {
			stmt.finalize()
		}
	}

	public query(query: QueryParams): ModelValue[] {
		const [sql, properties, relations, params] = this.parseQuery(query)

		const stmt = new Query(this.db, sql)
		try {
			return stmt.all(params).map((row) => this.parseRecord(row, properties, relations))
		} finally {
			stmt.finalize()
		}
	}

	public *iterate(query: QueryParams): Iterable<ModelValue> {
		const [sql, properties, relations, params] = this.parseQuery(query)

		const stmt = new Query(this.db, sql)
		try {
			for (const row of stmt.iterate(params)) {
				yield this.parseRecord(row, properties, relations)
			}
		} finally {
			stmt.finalize()
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
		sql.push(`SELECT ${selectExpression} FROM "${this.table}"`)

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
				assert(name in this.properties, "invalid orderBy index")
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
