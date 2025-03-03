import { OpfsDatabase } from "@sqlite.org/sqlite-wasm"

import { Relation, Config } from "@canvas-js/modeldb"
import { SqlitePrimitiveValue, columnTypes } from "./encoding.js"
import { Method, Query, quote } from "./utils.js"

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

	public constructor(readonly db: OpfsDatabase, readonly config: Config, readonly relation: Relation) {
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

	public drop() {
		this.db.exec(`DROP TABLE "${this.table}"`)
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
