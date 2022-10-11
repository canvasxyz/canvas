import type { ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"

import assert from "node:assert"
import Database, * as sqlite from "better-sqlite3"
import chalk from "chalk"

import { mapEntries, signalInvalidType } from "../utils.js"
import type { Effect } from "./types.js"

export class ModelStore {
	public static DATABASE_FILENAME = "models.sqlite"
	public readonly database: sqlite.Database

	private readonly transaction: (context: ActionContext, effects: Effect[]) => void
	private readonly routeStatements: Record<string, sqlite.Statement> = {}
	private readonly modelStatements: Record<
		string,
		Record<keyof ReturnType<typeof ModelStore.getModelStatements>, sqlite.Statement>
	> = {}

	constructor(
		path: string | null,
		models: Record<string, Model>,
		routes: Record<string, string>,
		options: { verbose?: boolean } = {}
	) {
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

		this.initializeModelTables(models)
		for (const [name, model] of Object.entries(models)) {
			this.modelStatements[name] = mapEntries(ModelStore.getModelStatements(name, model), (_, sql) =>
				this.database.prepare(sql)
			)
		}

		if (routes !== undefined) {
			for (const [route, query] of Object.entries(routes)) {
				this.routeStatements[route] = this.database.prepare(query)
			}
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

	public getRoute(route: string, params: Record<string, ModelValue>): Record<string, ModelValue>[] {
		assert(route in this.routeStatements, "invalid route name")
		return this.routeStatements[route].all(
			mapEntries(params, (_, value) => (typeof value === "boolean" ? Number(value) : value))
		)
	}

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
		for (const [name, { indexes, id, updated_at, ...properties }] of Object.entries(models)) {
			assert(id === "string", "id property must be 'string'")
			assert(updated_at === "datetime", "updated_at property must be 'datetime'")

			const deletedTableName = ModelStore.deletedTableName(name)
			const createDeletedTable = `CREATE TABLE IF NOT EXISTS ${deletedTableName} (id TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);`
			this.database.exec(createDeletedTable)

			const columns = ["id TEXT PRIMARY KEY NOT NULL", "updated_at INTEGER NOT NULL"]
			for (const [property, type] of Object.entries(properties)) {
				columns.push(`'${property}' ${ModelStore.getColumnType(type)}`)
			}

			const tableName = ModelStore.modelTableName(name)

			const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")});`
			this.database.exec(createTable)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = ModelStore.indexName(name, property)
					const propertyName = ModelStore.propertyName(property)
					this.database.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${propertyName});`)
				}
			}
		}
	}

	private static getModelStatements(name: string, { id, updated_at, indexes, ...properties }: Model) {
		const keys = ["updated_at", ...Object.keys(properties)]
		const values = keys.map((key) => `:${key}`).join(", ")
		const updates = keys.map((key) => `${ModelStore.propertyName(key)} = :${key}`).join(", ")

		const tableName = ModelStore.modelTableName(name)
		const deletedTableName = ModelStore.deletedTableName(name)
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
