import assert, { AssertionError } from "node:assert"
import path from "node:path"
import fs from "node:fs"
import chalk from "chalk"

import type { Action, Session, ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"
import Database, * as sqlite from "better-sqlite3"

import { actionType, sessionType } from "./codecs.js"
import { mapEntries, signalInvalidType, PAGE_SIZE } from "./utils.js"

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
	private readonly messageStatements: Record<string, sqlite.Statement>

	insertAction: (key: string, action: Action) => Promise<void>
	insertSession: (key: string, session: Session) => Promise<void>
	getAction: (key: string) => Promise<Action | null>
	getSession: (key: string) => Promise<Session | null>
	getActionStream: (limit: number) => AsyncIterable<[string, Action]>
	getSessionStream: (limit: number) => AsyncIterable<[string, Session]>
	getHistoryStream: (limit: number) => AsyncIterable<[string, Action | Session]>

	constructor(
		directory: string | null,
		models: Record<string, Model>,
		routes: Record<string, string>,
		replay: boolean
	) {
		if (directory === null) {
			this.database = new Database(":memory:")
			console.log("[canvas-core] Initializing new in-memory model database")
			Store.initializeMessageTables(this.database, models)
			Store.initializeModelTables(this.database, models)
		} else {
			const databasePath = path.resolve(directory, Store.DATABASE_FILENAME)
			if (fs.existsSync(databasePath)) {
				console.log(`[canvas-core] Found existing model database at ${databasePath}`)
				this.database = new Database(databasePath, { fileMustExist: true })
				if (replay) {
					Store.initializeModelTables(this.database, models)
				}
				Store.validateDatabase(this.database, models)
			} else {
				console.log(`[canvas-core] Initializing new model database at ${databasePath}`)
				this.database = new Database(databasePath)
				Store.initializeMessageTables(this.database, models)
				Store.initializeModelTables(this.database, models)
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

		this.messageStatements = {
			insertAction: this.database.prepare("INSERT INTO _messages (key, data, action) VALUES (:key, :data, true)"),
			insertSession: this.database.prepare("INSERT INTO _messages (key, data, session) VALUES (:key, :data, true)"),
			getAction: this.database.prepare("SELECT * FROM _messages WHERE action = true AND key = :key"),
			getSession: this.database.prepare("SELECT * FROM _messages WHERE session = true AND key = :key"),
			getSessions: this.database.prepare("SELECT * FROM _messages WHERE session = true AND id > :last LIMIT :limit"),
			getActions: this.database.prepare("SELECT * FROM _messages WHERE action = true AND id > :last LIMIT :limit"),
			getHistory: this.database.prepare("SELECT * FROM _messages WHERE id > :last LIMIT :limit"),
		}

		this.insertAction = async (key: string, action: Action) => {
			assert(actionType.is(action), "got invalid action")
			await this.messageStatements.insertAction.run({ key: key, data: JSON.stringify(action) })
		}

		this.insertSession = async (key: string, session: Session) => {
			assert(sessionType.is(session), "got invalid session")
			await this.messageStatements.insertSession.run({ key: key, data: JSON.stringify(session) })
		}

		this.getAction = async (key: string) => {
			const record = await this.messageStatements.getAction.get({ key })
			if (!record) return null
			assert(typeof record.data === "string", "got invalid action")
			const action = JSON.parse(record.data)
			assert(actionType.is(action), "got invalid action")
			return action
		}

		this.getSession = async (key: string) => {
			const record = await this.messageStatements.getSession.get({ key })
			if (!record) return null
			assert(typeof record.data === "string", "got invalid session")
			const session = JSON.parse(record.data)
			assert(sessionType.is(session), "got invalid session")
			return session
		}

		this.getActionStream = async function* (limit: number = PAGE_SIZE): AsyncIterable<[string, Action]> {
			let last = -1
			while (last !== undefined) {
				const page = await this.messageStatements.getActions.all({ last, limit })
				if (page.length === 0) return
				for (const message of page) {
					yield [message.key, JSON.parse(message.data) as Action]
					last = message?.id
				}
			}
		}

		this.getSessionStream = async function* (limit: number = PAGE_SIZE): AsyncIterable<[string, Session]> {
			let last = -1
			while (last !== undefined) {
				const page = await this.messageStatements.getSessions.all({ last, limit })
				if (page.length === 0) return
				for (const message of page) {
					yield [message.key, JSON.parse(message.data) as Session]
					last = message?.id
				}
			}
		}

		this.getHistoryStream = async function* (limit: number = PAGE_SIZE): AsyncIterable<[string, Action | Session]> {
			let last = -1
			while (last !== undefined) {
				const page = await this.messageStatements.getHistory.all({ last, limit })
				if (page.length === 0) return
				for (const message of page) {
					yield [message.key, JSON.parse(message.data)]
					last = message?.id
				}
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
		const schema = database.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all()
		const tables = schema
			.map((t) => t.name)
			.filter((t) => !t.startsWith("sqlite_"))
			.map((t) => `'${t}'`)
		const errors: string[] = []

		if (!tables.includes("'_messages'")) errors.push("missing _messages table")
		for (const [name, { indexes, ...properties }] of Object.entries(models)) {
			if (!tables.includes(Store.tableName(name))) errors.push("missing model table for " + name)
			if (!tables.includes(Store.deletedTableName(name))) errors.push("missing model deletion table for " + name)
		}

		if (errors.length > 0) {
			for (const error of errors) console.log(chalk.red(error))
			console.log(chalk.yellow("Model database looks out of sync. Try --replay to reset it."))
			process.exit(1)
		}
	}

	private static initializeMessageTables(database: sqlite.Database, models: Record<string, Model>) {
		const createMessagesTable =
			"CREATE TABLE _messages (id INTEGER PRIMARY KEY AUTOINCREMENT, key STRING, data TEXT, session BOOLEAN, action BOOLEAN);"
		const createMessagesIndex = "CREATE INDEX _messages_index ON _messages (key);"
		database.exec(createMessagesTable)
		database.exec(createMessagesIndex)
	}

	private static initializeModelTables(database: sqlite.Database, models: Record<string, Model>) {
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
