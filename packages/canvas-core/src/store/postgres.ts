import assert, { AssertionError } from "node:assert"
import path from "node:path"
import fs from "node:fs"
import chalk from "chalk"

import type { Action, Session, ActionContext, Model, ModelType, ModelValue } from "@canvas-js/interfaces"
import PgPromise from "pg-promise"

import { Store, Effect } from "./store.js"
import { actionType, sessionType } from "../codecs.js"
import { mapEntries, signalInvalidType, SQL_QUERY_LIMIT } from "../utils.js"

interface PgExtensions {}

interface ModelStatements {
	insert: string
	update: string
	delete: string
	insertDeleted: string
	updateDeleted: string
	getUpdatedAt: string
	getDeletedAt: string
}

interface BacklogStatements {
	insertAction: string
	insertSession: string
	getAction: string
	getSession: string
	getSessions: string
	getActions: string
	getHistory: string
}

export class PostgresStore extends Store {
	private readonly db: PgPromise.IDatabase<PgExtensions, any>
	private readonly routeStatements: Record<string, string>
	private readonly modelStatements: Record<string, ModelStatements>
	private readonly backlogStatements: BacklogStatements

	private onready: Function | null
	private isReady: boolean

	public ready(): Promise<void> {
		if (this.isReady) return new Promise((resolve, reject) => resolve())
		return new Promise((resolve, reject) => {
			if (this.onready !== null) throw new Error("ready handler can only be bound once")
			this.onready = () => resolve()
		})
	}

	constructor(url: string, models: Record<string, Model>, routes: Record<string, string>, replay: boolean) {
		super()

		const pgp = PgPromise() // TODO: use { pgNative: true } for pg-native bindings
		this.db = pgp(url)

		this.modelStatements = mapEntries(models, (name, { indexes, ...properties }) => {
			const keys = ["updated_at", ...Object.keys(properties)]
			const values = keys.map((key) => `$/${key}/`).join(", ")
			const updates = keys.map((key) => `${PostgresStore.propertyName(key)} = $/${key}/`).join(", ")

			const tableName = PostgresStore.tableName(name)
			const deletedTableName = PostgresStore.deletedTableName(name)
			return {
				insert: `INSERT INTO ${tableName} VALUES ($/id/, ${values})`,
				update: `UPDATE ${tableName} SET ${updates} WHERE id = $/id/`,
				delete: `DELETE FROM ${tableName} WHERE id = $/id/`,
				insertDeleted: `INSERT INTO ${deletedTableName} VALUES ($/id/, $/deleted_at/)`,
				updateDeleted: `UPDATE ${deletedTableName} SET deleted_at = $/deleted_at/ WHERE id = $/id/`,
				getUpdatedAt: `SELECT updated_at FROM ${tableName} WHERE id = $/id/`,
				getDeletedAt: `SELECT deleted_at FROM ${deletedTableName} WHERE id = $/id/`,
			}
		})

		this.backlogStatements = {
			insertAction: "INSERT INTO _messages (key, data, action) VALUES ($/key/, $/data/, true)",
			insertSession: "INSERT INTO _messages (key, data, session) VALUES ($/key/, $/data/, true)",
			getAction: "SELECT * FROM _messages WHERE action = true AND key = $/key/",
			getSession: "SELECT * FROM _messages WHERE session = true AND key = $/key/",
			getSessions: "SELECT * FROM _messages WHERE session = true AND id > $/last/ LIMIT $/limit/",
			getActions: "SELECT * FROM _messages WHERE action = true AND id > $/last/ LIMIT $/limit/",
			getHistory: "SELECT * FROM _messages WHERE id > $/last/ LIMIT $/limit/",
		}

		this.routeStatements = mapEntries(routes, (route, query) => query)
		this.onready = null
		this.isReady = false

		if (replay) {
			this.initializeMessageTables(models).then(() => {
				// TODO: don't kill the action log!
				this.initializeModelTables(models).then(() => {
					this.validateDatabase(models).then(() => {
						if (this.onready) this.onready()
						this.isReady = true
					})
				})
			})
		} else {
			this.validateDatabase(models).then(() => {
				if (this.onready) this.onready()
				this.isReady = true
			})
		}
		// if (reset) {
		//   await this.initializeMessageTables(models)
		//   await this.initializeModelTables(models)
		// }
	}

	public async insertAction(key: string, action: Action) {
		assert(actionType.is(action), "got invalid action")
		await this.db.none(this.backlogStatements.insertAction, { key: key, data: JSON.stringify(action) })
	}

	public async insertSession(key: string, session: Session) {
		assert(sessionType.is(session), "got invalid session")
		await this.db.none(this.backlogStatements.insertSession, { key: key, data: JSON.stringify(session) })
	}

	public async getAction(key: string) {
		const record = await this.db.oneOrNone(this.backlogStatements.getAction, { key })
		if (!record) return null
		assert(typeof record.data === "string", "got invalid action")
		const action = JSON.parse(record.data)
		assert(actionType.is(action), "got invalid action")
		return action
	}

	public async getSession(key: string) {
		const record = await this.db.oneOrNone(this.backlogStatements.getSession, { key })
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
			const page = await this.db.any(this.backlogStatements.getActions, { last, limit })
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
			const page = await this.db.any(this.backlogStatements.getSessions, { last, limit })
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
			const page = await this.db.any(this.backlogStatements.getHistory, { last, limit })
			if (page.length === 0) return
			for (const message of page) {
				yield [message.key, JSON.parse(message.data)]
				last = message?.id
			}
		}
	}

	public async applyEffects(context: ActionContext, effects: Effect[]): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db
				.tx(async (t: PgPromise.ITask<PgExtensions>) => {
					for (const effect of effects) {
						const updatedAt = (await t.oneOrNone(this.modelStatements[effect.model].getUpdatedAt, { id: effect.id }))
							?.updated_at
						if (updatedAt !== undefined && updatedAt > context.timestamp) {
							continue
						}

						const deletedAt = (await t.oneOrNone(this.modelStatements[effect.model].getDeletedAt, { id: effect.id }))
							?.deleted_at
						if (deletedAt !== undefined && deletedAt > context.timestamp) {
							continue
						}

						const statements = this.modelStatements[effect.model]
						if (effect.type === "set") {
							const params: Record<string, ModelValue> = { id: effect.id, updated_at: context.timestamp }
							for (const [property, value] of Object.entries(effect.values)) {
								params[property] = value
							}

							if (updatedAt === undefined) {
								await t.none(statements.insert, params)
							} else {
								await t.none(statements.update, params)
							}
						} else if (effect.type === "del") {
							if (deletedAt === undefined) {
								await t.none(statements.insertDeleted, { id: effect.id, deleted_at: context.timestamp })
							} else {
								await t.none(statements.updateDeleted, { id: effect.id, deleted_at: context.timestamp })
							}

							if (updatedAt !== undefined) {
								await t.none(statements.delete, { id: effect.id })
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
		assert(route in this.routeStatements, "invalid route name")
		const result = this.db.any(
			this.routeStatements[route],
			mapEntries(params, (param, value) => value)
		)
		return result
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

	private async validateDatabase(models: Record<string, Model>) {
		const schema = await this.db.any(
			"SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';"
		)
		const tables = schema.map((t) => t.tablename).map((t) => `"${t}"`)
		const errors: string[] = []
		if (!tables.includes('"_messages"')) errors.push("missing _messages table")
		for (const [name, { indexes, ...properties }] of Object.entries(models)) {
			if (!tables.includes(PostgresStore.tableName(name))) errors.push("missing model table for " + name)
			if (!tables.includes(PostgresStore.deletedTableName(name)))
				errors.push("missing model deletion table for " + name)
		}
		if (errors.length > 0) {
			for (const error of errors) console.error(chalk.red(error))
			console.error(chalk.yellow("Model database looks out of sync. Try --replay to reset it."))
			process.exit(1)
		}
	}

	private async initializeMessageTables(models: Record<string, Model>) {
		await this.db.none("DROP TABLE IF EXISTS _messages;")
		await this.db.none("DROP INDEX IF EXISTS _messages_index;")

		const createMessagesTable =
			"CREATE TABLE _messages (id SERIAL PRIMARY KEY, key TEXT, data TEXT, session BOOLEAN, action BOOLEAN);"
		const createMessagesIndex = "CREATE INDEX _messages_index ON _messages (key);"
		await this.db.none(createMessagesTable)
		await this.db.none(createMessagesIndex)
	}

	private async initializeModelTables(models: Record<string, Model>) {
		for (const [name, { indexes, ...properties }] of Object.entries(models)) {
			const deletedTableName = PostgresStore.deletedTableName(name)
			await this.db.none(`DROP TABLE IF EXISTS ${deletedTableName};`)
			const createDeletedTable = `CREATE TABLE ${deletedTableName} (id TEXT PRIMARY KEY NOT NULL, deleted_at BIGINT NOT NULL);`
			await this.db.none(createDeletedTable)

			const columns = ["id TEXT PRIMARY KEY NOT NULL", "updated_at BIGINT NOT NULL"]
			for (const [property, type] of Object.entries(properties)) {
				columns.push(`"${property}" ${PostgresStore.getColumnType(type)}`)
			}

			const tableName = PostgresStore.tableName(name)

			await this.db.none(`DROP TABLE IF EXISTS ${tableName};`)
			const createTable = `CREATE TABLE ${tableName} (${columns.join(", ")});`
			await this.db.none(createTable)

			if (indexes !== undefined) {
				for (const property of indexes) {
					const indexName = PostgresStore.indexName(name, property)
					const propertyName = PostgresStore.propertyName(property)
					await this.db.none(`DROP INDEX IF EXISTS ${indexName};`)
					await this.db.none(`CREATE INDEX ${indexName} ON ${tableName} (${propertyName});`)
				}
			}
		}
	}
}
