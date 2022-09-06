import assert from "node:assert"
import Database, * as sqlite from "better-sqlite3"
import chalk from "chalk"

import type { ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"

import { ModelStore, Effect } from "./store.js"
import { mapEntries, signalInvalidType } from "../utils.js"

export class SqliteStore implements ModelStore {
	public static DATABASE_FILENAME = "models.sqlite"

	public readonly database: sqlite.Database

	private readonly transaction: (context: ActionContext, effects: Effect[]) => void
	// private readonly routeStatements: Record<string, sqlite.Statement>
	private readonly modelStatements: Record<
		string,
		Record<keyof ReturnType<typeof SqliteStore.getModelStatements>, sqlite.Statement>
	> = {}

	public ready(): Promise<void> {
		// better-sqlite3 initializes synchronously, so the core is always ready()
		return Promise.resolve()
	}

	constructor(path: string | null, options: { verbose?: boolean } = {}) {
		if (path === null) {
			if (options.verbose) {
				console.log("[canvas-core] Initializing new in-memory database")
				console.warn(chalk.yellow("[canvas-core] All data will be lost on close!"))
			}

			this.database = new Database(":memory:")
		} else {
			if (options.verbose) {
				console.log(`[canvas-core] Initializing database at ${path}`)
			}

			this.database = new Database(path)
		}

		this.transaction = this.database.transaction((context: ActionContext, effects: Effect[]): void => {
			for (const effect of effects) {
				const updatedAt = this.getUpdatedAt(effect.model, effect.id)
				if (updatedAt !== undefined && updatedAt > context.timestamp) {
					continue
				}

				const deletedAt = this.getDeletedAt(effect.model, effect.id)
				if (deletedAt !== undefined && deletedAt > context.timestamp) {
					continue
				}

				const statements = this.modelStatements[effect.model]
				if (effect.type === "set") {
					// sqlite doesn't actually support booleans, just integers,
					// and better-sqlite doesn't convert them automatically
					const params: Record<string, ModelValue> = { id: effect.id, updated_at: context.timestamp }
					for (const [property, value] of Object.entries(effect.values)) {
						params[property] = typeof value === "boolean" ? Number(value) : value
					}

					if (updatedAt === undefined) {
						statements.insert.run(params)
					} else {
						statements.update.run(params)
					}
				} else if (effect.type === "del") {
					if (deletedAt === undefined) {
						statements.insertDeleted.run({ id: effect.id, deleted_at: context.timestamp })
					} else {
						statements.updateDeleted.run({ id: effect.id, deleted_at: context.timestamp })
					}

					if (updatedAt !== undefined) {
						statements.delete.run({ id: effect.id })
					}
				} else {
					signalInvalidType(effect)
				}
			}
		})

		// this.routeStatements = mapEntries(config.routes, (route, query) => this.database.prepare(query))
	}

	public async initialize(models: Record<string, Model>) {
		this.initializeModelTables(models)
		for (const [name, model] of Object.entries(models)) {
			this.modelStatements[name] = mapEntries(SqliteStore.getModelStatements(name, model), (_, sql) =>
				this.database.prepare(sql)
			)
		}
	}

	private getUpdatedAt(name: string, id: string): number | undefined {
		const { getUpdatedAt } = this.modelStatements[name]
		const result: { updated_at: number } | undefined = getUpdatedAt.get(id)
		return result && result.updated_at
	}

	private getDeletedAt(name: string, id: string): number | undefined {
		const { getDeletedAt } = this.modelStatements[name]
		const result: { updated_at: number } | undefined = getDeletedAt.get(id)
		return result && result.updated_at
	}

	public async applyEffects(context: ActionContext, effects: Effect[]) {
		this.transaction(context, effects)
	}

	public close() {
		this.database.close()
	}

	// public async getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]> {
	// 	assert(route in this.routeStatements, "invalid route name")
	// 	return this.routeStatements[route].all(
	// 		mapEntries(params, (_, value) => (typeof value === "boolean" ? Number(value) : value))
	// 	)
	// }

	// We have to be sure to quote these because, even though we validate that they're all [a-z_]+ elsewhere,
	// because they might be reserved SQL keywords.
	private static modelTableName = (modelName: string) => `'${modelName}'`
	private static deletedTableName = (modelName: string) => `'_${modelName}_deleted'`
	private static propertyName = (propertyName: string) => `'${propertyName}'`
	private static indexName = (modelName: string, propertyName: string) => `'${modelName}:${propertyName}'`

	private static getColumnType(type: ModelType): string {
		switch (type) {
			case "boolean":
				return "INTEGER"
			case "string":
				return "TEXT"
			case "integer":
				return "INTEGER"
			case "float":
				return "FLOAT"
			case "datetime":
				return "INTEGER"
			default:
				signalInvalidType(type)
		}
	}

	private initializeModelTables(models: Record<string, Model>) {
		for (const [name, { indexes, ...properties }] of Object.entries(models)) {
			const deletedTableName = SqliteStore.deletedTableName(name)
			const createDeletedTable = `CREATE TABLE IF NOT EXISTS ${deletedTableName} (id TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);`
			this.database.exec(createDeletedTable)

			const columns = ["id TEXT PRIMARY KEY NOT NULL", "updated_at INTEGER NOT NULL"]
			for (const [property, type] of Object.entries(properties)) {
				columns.push(`'${property}' ${SqliteStore.getColumnType(type)}`)
			}

			const tableName = SqliteStore.modelTableName(name)

			const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")});`
			this.database.exec(createTable)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = SqliteStore.indexName(name, property)
					const propertyName = SqliteStore.propertyName(property)
					this.database.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${propertyName});`)
				}
			}
		}
	}

	private static getModelStatements(name: string, { indexes, ...properties }: Model) {
		const keys = ["updated_at", ...Object.keys(properties)]
		const values = keys.map((key) => `:${key}`).join(", ")
		const updates = keys.map((key) => `${SqliteStore.propertyName(key)} = :${key}`).join(", ")

		const tableName = SqliteStore.modelTableName(name)
		const deletedTableName = SqliteStore.deletedTableName(name)
		return {
			insert: `INSERT INTO ${tableName} VALUES (:id, ${values})`,
			update: `UPDATE ${tableName} SET ${updates} WHERE id = :id`,
			delete: `DELETE FROM ${tableName} WHERE id = :id`,
			insertDeleted: `INSERT INTO ${deletedTableName} VALUES (:id, :deleted_at)`,
			updateDeleted: `UPDATE ${deletedTableName} SET deleted_at = :deleted_at WHERE id = :id`,
			getUpdatedAt: `SELECT updated_at FROM ${tableName} WHERE id = ?`,
			getDeletedAt: `SELECT deleted_at FROM ${deletedTableName} WHERE id = ?`,
		}
	}
}
