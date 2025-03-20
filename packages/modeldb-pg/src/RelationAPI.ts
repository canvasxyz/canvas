import pg from "pg"

import { Relation, Config } from "@canvas-js/modeldb"
import { PostgresPrimitiveValue, columnTypes } from "./encoding.js"
import { Method, Query, quote } from "./utils.js"

export class RelationAPI {
	public readonly table: string

	readonly #select: Query
	readonly #insert: Method
	readonly #delete: Method
	readonly #clear: Method

	public static async create(client: pg.Client, config: Config, relation: Relation, clear: boolean = false) {
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
		// TODO
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
