import assert from "node:assert"
import path from "node:path"
import fs from "node:fs"

import type { ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"
import Database, * as sqlite from "better-sqlite3"

import { mapEntries, signalInvalidType } from "./utils.js"

export type Effect =
	| { type: "set"; model: string; id: string; values: Record<string, ModelValue> }
	| { type: "del"; model: string; id: string }

interface ModelStatements {
	insert: sqlite.Statement
	update: sqlite.Statement
	delete: sqlite.Statement
	insertDeleted: sqlite.Statement
	updateDeleted: sqlite.Statement
	getUpdatedAt: sqlite.Statement
	getDeletedAt: sqlite.Statement
}

export class Store {
	public static DATABASE_FILENAME = "db.sqlite"

	private readonly database: sqlite.Database
	private readonly statements: Record<string, ModelStatements>
	private readonly transaction: (context: ActionContext, effects: Effect[]) => void
	private readonly routeStatements: Record<string, sqlite.Statement>

	constructor(directory: string | null, models: Record<string, Model>, routes: Record<string, string>) {
		if (directory === null) {
			this.database = new Database(":memory:")
			console.log("[canvas-core] Initializing new in-memory model database")
			Store.initializeDatabase(this.database, models)
		} else {
			const databasePath = path.resolve(directory, Store.DATABASE_FILENAME)
			if (fs.existsSync(databasePath)) {
				console.log(`[canvas-core] Found existing model database at ${databasePath}`)
				this.database = new Database(databasePath, { fileMustExist: true })
				Store.validateDatabase(this.database, models)
			} else {
				console.log(`[canvas-core] Initializing new model database at ${databasePath}`)
				this.database = new Database(databasePath)
				Store.initializeDatabase(this.database, models)
			}
		}

		this.statements = mapEntries(models, (name, { indexes, ...properties }) => {
			const keys = ["updated_at", ...Object.keys(properties)]
			const values = keys.map((key) => `:${key}`).join(", ")
			const updates = keys.map((key) => `${Store.propertyName(key)} = :${key}`).join(", ")

			const tableName = Store.tableName(name)
			const deletedTableName = Store.deletedTableName(name)
			return {
				insert: this.database.prepare(`INSERT INTO ${tableName} VALUES (:id, ${values})`),
				update: this.database.prepare(`UPDATE ${tableName} SET ${updates} WHERE id = :id`),
				delete: this.database.prepare(`DELETE FROM ${tableName} WHERE id = :id`),
				insertDeleted: this.database.prepare(`INSERT INTO ${deletedTableName} VALUES (:id, :deleted_at)`),
				updateDeleted: this.database.prepare(`UPDATE ${deletedTableName} SET deleted_at = :deleted_at WHERE id = :id`),
				getUpdatedAt: this.database.prepare(`SELECT updated_at FROM ${tableName} WHERE id = ?`),
				getDeletedAt: this.database.prepare(`SELECT deleted_at FROM ${deletedTableName} WHERE id = ?`),
			}
		})

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

				const statements = this.statements[effect.model]
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

		this.routeStatements = mapEntries(routes, (route, query) => this.database.prepare(query))
	}

	private getUpdatedAt(name: string, id: string): number | undefined {
		const { getUpdatedAt } = this.statements[name]
		const result: { updated_at: number } | undefined = getUpdatedAt.get(id)
		return result && result.updated_at
	}

	private getDeletedAt(name: string, id: string): number | undefined {
		const { getDeletedAt } = this.statements[name]
		const result: { updated_at: number } | undefined = getDeletedAt.get(id)
		return result && result.updated_at
	}

	public applyEffects(context: ActionContext, effects: Effect[]) {
		this.transaction(context, effects)
	}

	public close() {
		this.database.close()
	}

	public getRoute(route: string, params: Record<string, ModelValue>): Record<string, ModelValue>[] {
		assert(route in this.routeStatements, "invalid route name")
		return this.routeStatements[route].all(
			mapEntries(params, (param, value) => (typeof value === "boolean" ? Number(value) : value))
		)
	}

	// We have to be sure to quote these because, even though we validate that they're all [a-z_]+ elsewhere,
	// because they might be reserved SQL keywords.
	private static tableName = (modelName: string) => `'${modelName}'`
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

	private static validateDatabase(database: sqlite.Database, models: Record<string, Model>) {
		// TODO
	}

	private static initializeDatabase(database: sqlite.Database, models: Record<string, Model>) {
		for (const [name, { indexes, ...properties }] of Object.entries(models)) {
			const deletedTableName = Store.deletedTableName(name)
			const createDeletedTable = `CREATE TABLE ${deletedTableName} (id TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);`
			database.exec(createDeletedTable)

			const columns = ["id TEXT PRIMARY KEY NOT NULL", "updated_at INTEGER NOT NULL"]
			for (const [property, type] of Object.entries(properties)) {
				columns.push(`'${property}' ${Store.getColumnType(type)}`)
			}

			const tableName = Store.tableName(name)

			const createTable = `CREATE TABLE ${tableName} (${columns.join(", ")});`
			database.exec(createTable)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = Store.indexName(name, property)
					const propertyName = Store.propertyName(property)
					database.exec(`CREATE INDEX ${indexName} ON ${tableName} (${propertyName});`)
				}
			}
		}
	}
}
