import assert from "node:assert"
import path from "node:path"

import type { Action, Session, ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"
import Database, * as sqlite from "better-sqlite3"

import { Store, StoreConfig, Effect } from "./store.js"
import { actionType, sessionType } from "../codecs.js"
import { mapEntries, signalInvalidType, SQL_QUERY_LIMIT } from "../utils.js"

interface ModelStatements {
	insert: sqlite.Statement
	update: sqlite.Statement
	delete: sqlite.Statement
	insertDeleted: sqlite.Statement
	updateDeleted: sqlite.Statement
	getUpdatedAt: sqlite.Statement
	getDeletedAt: sqlite.Statement
}

interface BacklogStatements {
	insertAction: sqlite.Statement
	insertSession: sqlite.Statement
	getAction: sqlite.Statement
	getSession: sqlite.Statement
	getSessions: sqlite.Statement
	getActions: sqlite.Statement
	getHistory: sqlite.Statement
}

export class SqliteStore implements Store {
	public static DATABASE_FILENAME = "db.sqlite"

	private readonly database: sqlite.Database
	private readonly transaction: (context: ActionContext, effects: Effect[]) => void
	private readonly routeStatements: Record<string, sqlite.Statement>
	private readonly modelStatements: Record<string, ModelStatements>
	private readonly backlogStatements: BacklogStatements

	public ready(): Promise<void> {
		// better-sqlite3 initializes synchronously, so the core is always ready()
		return Promise.resolve()
	}

	constructor(config: StoreConfig) {
		if (config.databaseURI === null) {
			this.database = new Database(":memory:")
			console.error("[canvas-core] Initializing new in-memory database")
			SqliteStore.initializeMessageTables(this.database)
			SqliteStore.initializeModelTables(this.database, config.models)
		} else {
			assert(config.databaseURI.startsWith("file:"), "SQLite databases must use file URIs (e.g. file:db.sqlite)")
			const databasePath = config.databaseURI.slice("file:".length)

			console.error(`[canvas-core] Initializing database at ${databasePath}`)
			this.database = new Database(databasePath)
			if (config.reset) {
				console.error(`[canvas-core] Deleting message tables in ${databasePath}`)
				SqliteStore.deleteMessageTables(this.database)
				console.error(`[canvas-core] Deleting model tables in ${databasePath}`)
				SqliteStore.deleteModelTables(this.database, config.models)
			} else if (config.replay) {
				console.error(`[canvas-core] Deleting model tables in ${databasePath}`)
				SqliteStore.deleteModelTables(this.database, config.models)
			}

			SqliteStore.initializeMessageTables(this.database)
			SqliteStore.initializeModelTables(this.database, config.models)
		}

		this.modelStatements = mapEntries(config.models, (name, { indexes, ...properties }) => {
			const keys = ["updated_at", ...Object.keys(properties)]
			const values = keys.map((key) => `:${key}`).join(", ")
			const updates = keys.map((key) => `${SqliteStore.propertyName(key)} = :${key}`).join(", ")

			const tableName = SqliteStore.tableName(name)
			const deletedTableName = SqliteStore.deletedTableName(name)
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

		this.backlogStatements = {
			insertAction: this.database.prepare("INSERT INTO _messages (key, data, action) VALUES (:key, :data, true)"),
			insertSession: this.database.prepare("INSERT INTO _messages (key, data, session) VALUES (:key, :data, true)"),
			getAction: this.database.prepare("SELECT * FROM _messages WHERE action = true AND key = :key"),
			getSession: this.database.prepare("SELECT * FROM _messages WHERE session = true AND key = :key"),
			getSessions: this.database.prepare("SELECT * FROM _messages WHERE session = true AND id > :last LIMIT :limit"),
			getActions: this.database.prepare("SELECT * FROM _messages WHERE action = true AND id > :last LIMIT :limit"),
			getHistory: this.database.prepare("SELECT * FROM _messages WHERE id > :last LIMIT :limit"),
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

		this.routeStatements = mapEntries(config.routes, (route, query) => this.database.prepare(query))
	}

	public async insertAction(key: string, action: Action) {
		assert(actionType.is(action), "got invalid action")
		await this.backlogStatements.insertAction.run({ key: key, data: JSON.stringify(action) })
	}

	public async insertSession(key: string, session: Session) {
		assert(sessionType.is(session), "got invalid session")
		await this.backlogStatements.insertSession.run({ key: key, data: JSON.stringify(session) })
	}

	public async getAction(key: string) {
		const record = await this.backlogStatements.getAction.get({ key })
		if (!record) return null
		assert(typeof record.data === "string", "got invalid action")
		const action = JSON.parse(record.data)
		assert(actionType.is(action), "got invalid action")
		return action
	}

	public async getSession(key: string) {
		const record = await this.backlogStatements.getSession.get({ key })
		if (!record) return null
		assert(typeof record.data === "string", "got invalid session")
		const session = JSON.parse(record.data)
		assert(sessionType.is(session), "got invalid session")
		return session
	}

	// unused
	public async *getActionStream(limit: number = SQL_QUERY_LIMIT): AsyncIterable<[string, Action]> {
		let last = -1
		while (last !== undefined) {
			const page = await this.backlogStatements.getActions.all({ last, limit })
			if (page.length === 0) return
			for (const message of page) {
				yield [message.key, JSON.parse(message.data) as Action]
				last = message?.id
			}
		}
	}

	// unused
	public async *getSessionStream(limit: number = SQL_QUERY_LIMIT): AsyncIterable<[string, Session]> {
		let last = -1
		while (last !== undefined) {
			const page = await this.backlogStatements.getSessions.all({ last, limit })
			if (page.length === 0) return
			for (const message of page) {
				yield [message.key, JSON.parse(message.data)]
				last = message?.id
			}
		}
	}

	// unused
	public async *getHistoryStream(limit: number = SQL_QUERY_LIMIT): AsyncIterable<[string, Action | Session]> {
		let last = -1
		while (last !== undefined) {
			const page = await this.backlogStatements.getHistory.all({ last, limit })
			if (page.length === 0) return
			for (const message of page) {
				yield [message.key, JSON.parse(message.data)]
				last = message?.id
			}
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

	private static initializeMessageTables(database: sqlite.Database) {
		const createMessagesTable =
			"CREATE TABLE IF NOT EXISTS _messages (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, data TEXT, session BOOLEAN, action BOOLEAN);"
		const createMessagesIndex = "CREATE INDEX IF NOT EXISTS _messages_index ON _messages (key);"
		database.exec(createMessagesTable)
		database.exec(createMessagesIndex)
	}

	private static deleteMessageTables(database: sqlite.Database) {
		const dropMessagesIndex = "DROP INDEX IF EXISTS _messages_index;"
		database.exec(dropMessagesIndex)
		const dropMessagesTable = "DROP TABLE IF EXISTS _messages;"
		database.exec(dropMessagesTable)
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

			const tableName = SqliteStore.tableName(name)

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
			const tableName = SqliteStore.tableName(name)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = SqliteStore.indexName(name, property)
					database.exec(`DROP INDEX IF EXISTS ${indexName};`)
				}
			}

			const dropTable = `DROP TABLE IF EXISTS ${tableName};`
			database.exec(dropTable)

			const deletedTableName = SqliteStore.deletedTableName(name)
			const dropDeletedTable = `DROP TABLE IF EXISTS ${deletedTableName};`
			database.exec(dropDeletedTable)
		}
	}
}
