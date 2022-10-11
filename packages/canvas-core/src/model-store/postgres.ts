import assert from "node:assert"

import PgPromise from "pg-promise"

const pgp = PgPromise() // TODO: use { pgNative: true } for pg-native bindings

import type { ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"

import { ModelStore, Effect } from "./store.js"
import { mapEntries, signalInvalidType } from "../utils.js"

export class PostgresStore implements ModelStore {
	private readonly db: PgPromise.IDatabase<{}, any>

	// we can't use prepared statements for routes because they only accept positional parameter :/
	// private readonly routeStatements: Record<string, PgPromise.PreparedStatement>
	private readonly routes: Record<string, string> = {}

	private readonly modelStatements: Record<
		string,
		Record<keyof ReturnType<typeof PostgresStore.getModelStatements>, PgPromise.PreparedStatement>
	> = {}

	// store an explicit array of model properties to be certain
	// that prepared statements are binding params in the right order
	private readonly modelProperties: Record<string, string[]> = {}

	constructor(databaseURI: string, options: { verbose?: boolean } = {}) {
		if (options.verbose) {
			console.log("[canvas-core] Connecting to Postgres database at", databaseURI)
		}

		this.db = pgp(databaseURI)
	}

	public get identifier(): string {
		return "postgres"
	}

	public async initialize(models: Record<string, Model>, routes?: Record<string, string>) {
		for (const [name, { id, updated_at, indexes, ...properties }] of Object.entries(models)) {
			assert(id === "string", "id property must be 'string'")
			assert(updated_at === "datetime", "updated_at property must be 'datetime'")

			const propertyKeys = Object.keys(properties)
			this.modelProperties[name] = propertyKeys
			this.modelStatements[name] = mapEntries(
				PostgresStore.getModelStatements(name, propertyKeys),
				(name, text) => new PgPromise.PreparedStatement({ name, text })
			)

			const deletedTableName = PostgresStore.deletedTableName(name)
			const createDeletedTable = `CREATE TABLE IF NOT EXISTS ${deletedTableName} (id TEXT PRIMARY KEY, deleted_at BIGINT NOT NULL);`
			await this.db.none(createDeletedTable)

			const columns = ["id TEXT PRIMARY KEY", "updated_at BIGINT NOT NULL"]
			for (const [property, type] of Object.entries(properties)) {
				columns.push(`"${property}" ${PostgresStore.getColumnType(type)}`)
			}

			const tableName = PostgresStore.tableName(name)
			const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")});`
			await this.db.none(createTable)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = PostgresStore.indexName(name, property)
					const propertyName = PostgresStore.propertyName(property)
					await this.db.none(`CREATE INDEX NOT EXISTS ${indexName} ON ${tableName} (${propertyName});`)
				}
			}
		}

		if (routes !== undefined) {
			for (const [name, query] of Object.entries(routes)) {
				this.routes[name] = query
			}
		}
	}

	public async applyEffects(context: ActionContext, effects: Effect[]): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db
				.tx(async (t) => {
					for (const effect of effects) {
						const statements = this.modelStatements[effect.model]

						const updatedAt = await t
							.oneOrNone<{ updated_at: number }>(statements.getUpdatedAt, [effect.id])
							.then((result) => result && result.updated_at)

						if (updatedAt !== null && updatedAt > context.timestamp) {
							continue
						}

						const deletedAt = await t
							.oneOrNone<{ deleted_at: number }>(statements.getDeletedAt, [effect.id])
							.then((result) => result && result.deleted_at)

						if (deletedAt !== null && deletedAt > context.timestamp) {
							continue
						}

						if (effect.type === "set") {
							const properties = this.modelProperties[effect.model]
							const params: ModelValue[] = [
								effect.id,
								context.timestamp,
								...properties.map((property) => effect.values[property]),
							]

							if (updatedAt === null) {
								await t.none(statements.insert, params)
							} else {
								await t.none(statements.update, params)
							}
						} else if (effect.type === "del") {
							if (deletedAt === null) {
								await t.none(statements.insertDeleted, [effect.id, context.timestamp])
							} else {
								await t.none(statements.updateDeleted, [effect.id, context.timestamp])
							}

							if (updatedAt !== null) {
								await t.none(statements.delete, [effect.id])
							}
						} else {
							signalInvalidType(effect)
						}
					}
				})
				.then(resolve)
				.catch(reject)
		})
	}

	public close() {
		// nothing to do, since pg-promise should handle connections for us
	}

	public async getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]> {
		assert(route in this.routes, "invalid route name")
		return this.db.any(this.routes[route], params)
	}

	// We have to be sure to quote these because, even though we validate that they're all [a-z_]+ elsewhere,
	// because they might be reserved SQL keywords.
	private static tableName = (modelName: string) => `"${modelName}"`
	private static deletedTableName = (modelName: string) => `"_${modelName}_deleted"`
	private static propertyName = (propertyName: string) => `"${propertyName}"`
	private static indexName = (modelName: string, propertyName: string) => `"${modelName}:${propertyName}"`

	private static getColumnType(type: ModelType): string {
		switch (type) {
			case "boolean":
				return "BOOLEAN"
			case "string":
				return "TEXT"
			case "integer":
				return "BIGINT"
			case "float":
				return "FLOAT"
			case "datetime":
				return "BIGINT"
			default:
				signalInvalidType(type)
		}
	}

	private static getModelStatements(name: string, propertyKeys: string[]) {
		const keys = ["updated_at", ...propertyKeys]
		const insertKeys = keys.map((key) => PostgresStore.propertyName(key)).join(", ")
		const insertValues = keys.map((_, i) => `$${i + 2}`).join(", ") // +2 because the id is always $1
		const updateEntries = keys.map((key, i) => `${PostgresStore.propertyName(key)} = $${i + 2}`).join(", ")

		const tableName = PostgresStore.tableName(name)
		const deletedTableName = PostgresStore.deletedTableName(name)
		return {
			insert: `INSERT INTO ${tableName} (id, ${insertKeys}) VALUES ($1, ${insertValues})`,
			update: `UPDATE ${tableName} SET ${updateEntries} WHERE id = $1`,
			delete: `DELETE FROM ${tableName} WHERE id = $1`,
			insertDeleted: `INSERT INTO ${deletedTableName} VALUES ($1, $2)`,
			updateDeleted: `UPDATE ${deletedTableName} SET deleted_at = $2 WHERE id = $1`,
			getUpdatedAt: `SELECT updated_at FROM ${tableName} WHERE id = $1`,
			getDeletedAt: `SELECT deleted_at FROM ${deletedTableName} WHERE id = $1`,
		}
	}
}
