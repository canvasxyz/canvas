import assert from "node:assert"

import Database, * as sqlite from "better-sqlite3"
import chalk from "chalk"
import { ethers } from "ethers"

import type { Action, Session, ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"
import { Store, StoreConfig, Effect } from "./store.js"

import { decodeAction, decodeSession, mapEntries, signalInvalidType } from "../utils.js"

export class SqliteStore implements Store {
	public static DATABASE_FILENAME = "db.sqlite"

	private readonly database: sqlite.Database
	private readonly transaction: (context: ActionContext, effects: Effect[]) => void
	private readonly routeStatements: Record<string, sqlite.Statement>
	private readonly messageStatements: Record<keyof typeof SqliteStore.messageStatements, sqlite.Statement>
	private readonly modelStatements: Record<
		string,
		Record<keyof ReturnType<typeof SqliteStore.getModelStatements>, sqlite.Statement>
	>

	public ready(): Promise<void> {
		// better-sqlite3 initializes synchronously, so the core is always ready()
		return Promise.resolve()
	}

	constructor(config: StoreConfig) {
		if (config.databaseURI === null) {
			this.database = new Database(":memory:")
			if (config.verbose) {
				console.log("[canvas-core] Initializing new in-memory database")
				console.warn(chalk.yellow("[canvas-core] All data will be lost on close!"))
			}

			SqliteStore.initializeMessageTables(this.database)
			SqliteStore.initializeModelTables(this.database, config.models)
		} else {
			assert(config.databaseURI.startsWith("file:"), "SQLite databases must use file URIs (e.g. file:db.sqlite)")
			const databasePath = config.databaseURI.slice("file:".length)

			if (config.verbose) console.log(`[canvas-core] Initializing database at ${databasePath}`)

			this.database = new Database(databasePath)
			if (config.reset) {
				if (config.verbose) console.warn(`[canvas-core] Deleting message tables in ${databasePath}`)
				SqliteStore.deleteMessageTables(this.database)
				if (config.verbose) console.warn(`[canvas-core] Deleting model tables in ${databasePath}`)
				SqliteStore.deleteModelTables(this.database, config.models)
			} else if (config.replay) {
				if (config.verbose) console.warn(`[canvas-core] Deleting model tables in ${databasePath}`)
				SqliteStore.deleteModelTables(this.database, config.models)
			}

			SqliteStore.initializeMessageTables(this.database)
			SqliteStore.initializeModelTables(this.database, config.models)
		}

		// tiny utility for preparing sets of string statements at once
		const prepare = <K extends string>(statements: Record<K, string>) =>
			mapEntries(statements, (_, sql) => this.database.prepare(sql))

		this.modelStatements = mapEntries(config.models, (name, model) =>
			prepare(SqliteStore.getModelStatements(name, model))
		)

		this.messageStatements = prepare(SqliteStore.messageStatements)

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

		this.routeStatements = mapEntries(config.routes, (route, query) => this.database.prepare(query))
	}

	public async insertAction(params: { hash: string; data: Uint8Array }) {
		this.messageStatements.insertAction.run({
			hash: ethers.utils.arrayify(params.hash),
			data: params.data,
		})
	}

	public async insertSession(params: { hash: string; data: Uint8Array; address: string }) {
		this.messageStatements.insertSession.run({
			hash: ethers.utils.arrayify(params.hash),
			data: params.data,
			address: ethers.utils.arrayify(params.address),
		})
	}

	public async getActionByHash(hash: string) {
		const record: undefined | { data: Buffer } = this.messageStatements.getActionByHash.get({
			hash: ethers.utils.arrayify(hash),
		})

		return record ? decodeAction(record.data) : null
	}

	public async getSessionByHash(hash: string) {
		const record: undefined | { data: Buffer } = await this.messageStatements.getSessionByHash.get({
			hash: ethers.utils.arrayify(hash),
		})

		return record ? decodeSession(record.data) : null
	}

	public async getSessionByAddress(address: string) {
		const record: undefined | { data: Buffer } = await this.messageStatements.getSessionByAddress.get({
			address: ethers.utils.arrayify(address),
		})

		return record ? decodeSession(record.data) : null
	}

	public async *getActionStream(): AsyncIterable<[string, Action]> {
		// we can use statement.iterate() instead of paging manually
		// https://github.com/WiseLibs/better-sqlite3/issues/406
		for (const result of this.messageStatements.getActions.iterate({})) {
			const { data, hash } = result as { data: Buffer; hash: Buffer }
			yield [ethers.utils.hexlify(hash), decodeAction(data)]
		}
	}

	public async *getSessionStream(): AsyncIterable<[string, Session]> {
		for (const result of this.messageStatements.getSessions.iterate({})) {
			const { data, hash } = result as { data: Buffer; hash: Buffer }
			yield [ethers.utils.hexlify(hash), decodeSession(data)]
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

	public async getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]> {
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

	private static initializeMessageTables(database: sqlite.Database) {
		const createSessionsTable = `CREATE TABLE IF NOT EXISTS _sessions (
			id      INTEGER PRIMARY KEY AUTOINCREMENT,
			hash    BLOB    NOT NULL UNIQUE,
			data    BLOB    NOT NULL,
			address BLOB    NOT NULL UNIQUE
		);`

		const createActionsTable = `CREATE TABLE IF NOT EXISTS _actions (
			id   INTEGER PRIMARY KEY AUTOINCREMENT,
			hash BLOB    NOT NULL UNIQUE,
			data BLOB    NOT NULL
		);`

		database.exec(createSessionsTable)
		database.exec(createActionsTable)
	}

	private static deleteMessageTables(database: sqlite.Database) {
		const dropSessionsTable = `DROP TABLE IF EXISTS _sessions;`
		const dropActionsTable = `DROP TABLE IF EXISTS _actions;`

		database.exec(dropSessionsTable)
		database.exec(dropActionsTable)
	}

	private static initializeModelTables(database: sqlite.Database, models: Record<string, Model>) {
		for (const [name, { indexes, ...properties }] of Object.entries(models)) {
			const deletedTableName = SqliteStore.deletedTableName(name)
			const createDeletedTable = `CREATE TABLE IF NOT EXISTS ${deletedTableName} (id TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);`
			database.exec(createDeletedTable)

			const columns = ["id TEXT PRIMARY KEY NOT NULL", "updated_at INTEGER NOT NULL"]
			for (const [property, type] of Object.entries(properties)) {
				columns.push(`'${property}' ${SqliteStore.getColumnType(type)}`)
			}

			const tableName = SqliteStore.modelTableName(name)

			const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")});`
			database.exec(createTable)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = SqliteStore.indexName(name, property)
					const propertyName = SqliteStore.propertyName(property)
					database.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${propertyName});`)
				}
			}
		}
	}

	private static deleteModelTables(database: sqlite.Database, models: Record<string, Model>) {
		for (const [name, { indexes }] of Object.entries(models)) {
			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = SqliteStore.indexName(name, property)
					database.exec(`DROP INDEX IF EXISTS ${indexName};`)
				}
			}

			const modelTableName = SqliteStore.modelTableName(name)
			const dropModelTable = `DROP TABLE IF EXISTS ${modelTableName};`
			database.exec(dropModelTable)

			const deletedTableName = SqliteStore.deletedTableName(name)
			const dropDeletedTable = `DROP TABLE IF EXISTS ${deletedTableName};`
			database.exec(dropDeletedTable)
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

	private static messageStatements = {
		insertAction: `INSERT INTO _actions (hash, data) VALUES (:hash, :data)`,
		insertSession: `INSERT INTO _sessions (hash, data, address) VALUES (:hash, :data, :address)`,
		getActionByHash: `SELECT data FROM _actions WHERE hash = :hash`,
		getSessionByHash: `SELECT data FROM _sessions WHERE hash = :hash`,
		getSessionByAddress: `SELECT data FROM _sessions WHERE address = :address`,
		getSessions: `SELECT hash, data FROM _sessions`,
		getActions: `SELECT hash, data FROM _actions`,
	}
}
