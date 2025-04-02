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
	PropertyValue,
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

type Statements = {
	// Methods
	insert: Method
	update: Method | null
	delete: Method
	clear: Method

	// Queries
	select: Query
	selectAll: Query
	selectMany: Query
	count: Query<{ count: number }>
}

export class ModelAPI {
	public static async create(client: pg.Client, config: Config, model: Model, clear: boolean = false) {
		const api = new ModelAPI(client, config, model)

		/** SQL column declarations */
		const columnDefinitions: string[] = []

		for (const property of model.properties) {
			await api.prepareProperty(property, columnDefinitions, clear)
		}

		await api.initialize(columnDefinitions, clear)
		api.prepareStatements()

		return api
	}

	readonly table: string

	#statements: Statements | null = null

	readonly codecs: Record<string, PropertyAPI<PostgresPrimitiveValue>> = {}
	readonly codecNames: string[] = []

	readonly relations: Record<string, RelationAPI> = {}
	readonly relationNames: string[] = []

	readonly properties: Record<string, Property> = {}
	readonly primaryProperties: PrimitiveProperty[]
	readonly mutableProperties: Property[] = []

	constructor(readonly client: pg.Client, readonly config: Config, readonly model: Model) {
		this.table = model.name
		this.primaryProperties = config.primaryKeys[model.name]
	}

	private get statements(): Statements {
		assert(this.#statements !== null, "internal error - unintinitalized")
		return this.#statements
	}

	private async prepareProperty(property: Property, columnDefinitions: string[], clear?: boolean) {
		this.properties[property.name] = property

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

			if (targetPrimaryProperties.length === 1) {
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

			await this.addRelation(relation, clear)
			this.mutableProperties.push(property)
		} else {
			signalInvalidType(property)
		}
	}

	private async initialize(columnDefinitions: string[], clear?: boolean) {
		const queries: string[] = []

		// Create record table

		if (clear) {
			queries.push(`DROP TABLE IF EXISTS "${this.table}"`)
		}

		const primaryKeyConstraint = `PRIMARY KEY (${this.model.primaryKey.map(quote).join(", ")})`
		const tableSchema = [...columnDefinitions, primaryKeyConstraint].join(", ")
		queries.push(`CREATE TABLE IF NOT EXISTS "${this.table}" (${tableSchema})`)

		// Create indexes
		for (const index of this.model.indexes) {
			if (index.length === 1 && index[0] in this.relations) {
				continue
			} else {
				assert(
					index.every((name) => this.relations[name] === undefined),
					"cannot index relation properties",
				)
			}

			const indexName = [this.model.name, ...index].join("/")
			const indexColumnNames = index.flatMap((name) => this.codecs[name].columns)
			const indexColumns = indexColumnNames.map(quote).join(", ")
			queries.push(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.table}" (${indexColumns})`)
		}

		await this.client.query(queries.join("; "))
	}

	private prepareStatements() {
		const columnNames = Object.values(this.codecs).flatMap((codec) => codec.columns)
		const mutableColumnNames = columnNames.filter((name) => !this.model.primaryKey.includes(name))

		const insertParams = Array.from({ length: columnNames.length })
			.map((_, i) => `$${i + 1}`)
			.join(", ")

		const quotedColumnNames = columnNames.map(quote).join(", ")
		const insert = new Method(
			this.client,
			`INSERT INTO "${this.table}" (${quotedColumnNames}) VALUES (${insertParams}) ON CONFLICT DO NOTHING`,
		)

		let update: Method | null = null
		if (mutableColumnNames.length > 0) {
			const updateEntries = mutableColumnNames.map((name, i) => `"${name}" = $${i + 1}`)
			const updateWhere = this.model.primaryKey
				.map((name, i) => `"${name}" = $${updateEntries.length + i + 1}`)
				.join(" AND ")

			update = new Method(this.client, `UPDATE "${this.table}" SET ${updateEntries.join(", ")} WHERE ${updateWhere}`)
		}

		const deleteWhere = this.model.primaryKey.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")
		const _delete = new Method(this.client, `DELETE FROM "${this.table}" WHERE ${deleteWhere}`)
		const clear = new Method(this.client, `DELETE FROM "${this.table}"`)

		// Prepare queries
		const count = new Query<{ count: number }>(this.client, `SELECT COUNT(*) AS count FROM "${this.table}"`)

		const selectWhere = this.model.primaryKey.map((name, i) => `"${name}" = $${i + 1}`).join(" AND ")
		const selectColumnNames = this.model.properties.flatMap((property) => {
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

		const select = new Query(
			this.client,
			`SELECT ${selectColumnNames.join(", ")} FROM "${this.table}" WHERE ${selectWhere}`,
		)

		const orderByPrimaryKey = this.model.primaryKey.map((name) => `"${name}" ASC`).join(", ")
		const selectAll = new Query(
			this.client,
			`SELECT ${selectColumnNames} FROM "${this.table}" ORDER BY ${orderByPrimaryKey}`,
		)

		const unnest = this.primaryProperties
			.map(({ type }, i) => `$${i + 1}::${columnTypes[type].toLowerCase()}[]`)
			.join(", ")

		const match = this.model.primaryKey.map((name) => `"${this.table}"."${name}" = "/keys"."${name}"`).join(" AND ")
		const primaryKeyNames = this.model.primaryKey.map(quote).join(", ")

		const selectMany = new Query(
			this.client,
			`
		WITH "/keys" AS (
		  SELECT ${primaryKeyNames}, "/index"::integer
			FROM unnest(${unnest})
			WITH ORDINALITY AS t(${primaryKeyNames}, "/index")
		)
		SELECT "/keys"."/index", ${selectColumnNames.map((c) => `"${this.table}".${c}`)} FROM "/keys"
		  LEFT JOIN "${this.table}" ON ${match}
		ORDER BY "/keys"."/index"
		`,
		)

		this.#statements = {
			insert,
			update,
			delete: _delete,
			count,
			select,
			selectAll,
			selectMany,
			clear,
		}
	}

	private addCodec(name: string, codec: PropertyAPI<PostgresPrimitiveValue>) {
		this.codecs[name] = codec
		this.codecNames.push(name)
	}

	private removeCodec(name: string) {
		delete this.codecs[name]
		const index = this.codecNames.indexOf(name)
		assert(index !== -1, "internal error - expected index !== -1")
		this.codecNames.splice(index, 1)
	}

	private async addRelation(relation: Relation, clear?: boolean) {
		const relationAPI = await RelationAPI.create(this.client, this.config, relation, clear)
		this.relations[relation.sourceProperty] = relationAPI
		this.relationNames.push(relation.sourceProperty)
	}

	private async removeRelation(propertyName: string) {
		const relationAPI = this.relations[propertyName]
		assert(relationAPI !== undefined, "internal error - expected relationAPI !== undefined")
		delete this.relations[propertyName]

		const index = this.relationNames.indexOf(propertyName)
		assert(index !== -1, "internal error - expected index !== -1")
		this.relationNames.splice(index, 1)

		await this.client.query(`DROP TABLE "${relationAPI.table}"`)
	}

	public async drop() {
		const queries: string[] = []
		for (const relationAPI of Object.values(this.relations)) {
			queries.push(`DROP TABLE "${relationAPI.table}";`)
		}

		queries.push(`DROP TABLE "${this.table}";`)
		await this.client.query(queries.join("\n"))
	}

	public async addProperty(property: Property, defaultPropertyValue: PropertyValue) {
		/** SQL column declarations */
		const columnDefinitions: string[] = []

		await this.prepareProperty(property, columnDefinitions, false)

		let targetProperties: PrimitiveProperty[]
		if (property.kind === "primitive") {
			targetProperties = [property]
		} else if (property.kind === "reference") {
			targetProperties = this.config.primaryKeys[property.target]
		} else if (property.kind === "relation") {
			targetProperties = this.config.primaryKeys[property.target]
		} else {
			signalInvalidType(property)
		}

		const defaultValues = this.codecs[property.name].encode(defaultPropertyValue).map((value, i) => {
			if (value === null) {
				return "NULL"
			} else if (typeof value === "boolean") {
				return value ? "TRUE" : "FALSE"
			} else if (typeof value === "number") {
				return value.toString()
			} else if (typeof value === "string") {
				if (targetProperties[i].type === "integer") {
					return value
				} else if (targetProperties[i].type === "string") {
					return quote(value.replace(/'/g, "''"))
				} else {
					throw new Error("internal error - unexpected string value")
				}
			} else if (value instanceof Uint8Array) {
				const hex = Array.from(value)
					.map((byte) => byte.toString(16).padStart(2, "0"))
					.join("")
				return `E'\\x${hex}'`
			} else {
				signalInvalidType(value)
			}
		})

		const alter = Array.from(zip(columnDefinitions, defaultValues))
			.map(([column, defaultValue]) => `ADD COLUMN ${column} DEFAULT ${defaultValue}`)
			.join(", ")

		await this.client.query(`ALTER TABLE "${this.table}" ${alter}`)
		this.prepareStatements()
	}

	public async removeProperty(propertyName: string) {
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
			await this.client.query(`ALTER TABLE "${this.table}" ${alter.join(", ")}`)
			this.removeCodec(propertyName)
		} else if (property.kind === "relation") {
			await this.removeRelation(propertyName)
		} else {
			signalInvalidType(property)
		}

		this.prepareStatements()
	}

	public async addIndex(propertyNames: string[]) {
		if (propertyNames.length === 1 && propertyNames[0] in this.relations) {
			const [propertyName] = propertyNames
			const relation = this.relations[propertyName]
			const targetIndex = `${this.table}/${propertyName}/target`
			const targetColumns = relation.targetColumnNames.map(quote).join(", ")
			await this.client.query(`CREATE INDEX IF NOT EXISTS "${targetIndex}" ON "${this.table}" (${targetColumns})`)
			return
		}

		assert(
			propertyNames.every((name) => this.relations[name] === undefined),
			"cannot index relation properties",
		)

		const indexName = [this.model.name, ...propertyNames].join("/")
		const indexColumnNames = propertyNames.flatMap((name) => this.codecs[name].columns)
		const indexColumns = indexColumnNames.map(quote).join(", ")
		await this.client.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${this.table}" (${indexColumns})`)
	}

	public async removeIndex(propertyNames: string[]) {
		if (propertyNames.length === 1 && propertyNames[0] in this.relations) {
			const [propertyName] = propertyNames
			const targetIndex = `${this.table}/${propertyName}/target`
			await this.client.query(`DROP INDEX IF EXISTS "${targetIndex}"`)
			return
		}

		const indexName = [this.model.name, ...propertyNames].join("/")
		await this.client.query(`DROP INDEX IF EXISTS "${indexName}"`)
	}

	public async get(key: PrimaryKeyValue | PrimaryKeyValue[]): Promise<ModelValue | null> {
		const wrappedKey = Array.isArray(key) ? key : [key]
		if (wrappedKey.length !== this.primaryProperties.length) {
			throw new TypeError(`${this.model.name}: expected primary key with ${this.primaryProperties.length} components`)
		}

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }, i) =>
			Encoder.encodePrimitiveValue(name, type, nullable, wrappedKey[i]),
		)

		const record = await this.statements.select.get(encodedKey)
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

		const rows = await this.statements.selectMany.all(columns)
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
		const rows = await this.statements.selectAll.all([])
		return Promise.all(rows.map((row) => this.parseRecord(row, this.codecNames, this.relationNames)))
	}

	public async set(value: ModelValue) {
		validateModelValue(this.model, value)

		const encodedKey = this.primaryProperties.map(({ name, type, nullable }) =>
			Encoder.encodePrimitiveValue(name, type, nullable, value[name]),
		)

		const { select, insert, update } = this.statements

		const existingRecord = await select.get(encodedKey)

		if (existingRecord === null) {
			const params = this.encodeProperties(this.model.properties, value)
			await insert.run(params)
		} else if (update !== null) {
			const params = this.encodeProperties(this.mutableProperties, value)
			await update.run([...params, ...encodedKey])
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

		await this.statements.delete.run(encodedKey)
		for (const relation of Object.values(this.relations)) {
			await relation.delete(encodedKey)
		}
	}

	public async clear() {
		await this.statements.clear.run([])
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
		const rows = await new Query(this.client, sql).all(params)
		return await Promise.all(rows.map((row) => this.parseRecord(row, properties, relations)))
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
			if (property.kind === "primitive") {
				properties.push(name)
				if (property.type === "json") {
					columns.push(`"${property.name}"::jsonb`)
				} else {
					columns.push(quote(name))
				}
			} else if (property.kind === "reference") {
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
