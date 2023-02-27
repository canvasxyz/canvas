import assert from "node:assert"
import path from "node:path"
import fs from "node:fs"

import Database, * as sqlite from "better-sqlite3"
import * as okra from "@canvas-js/okra-node"

import type { Action, Session, ActionArgument, Chain, ChainId, CustomAction, Message } from "@canvas-js/interfaces"

import { mapEntries, toHex, stringify, signalInvalidType } from "@canvas-js/core/utils"
import { MESSAGE_DATABASE_FILENAME, MST_DIRECTORY_NAME } from "@canvas-js/core/constants"

import { getMessageKey } from "@canvas-js/core/sync"

import type { MessageStore, ReadOnlyTransaction, ReadWriteTransaction, Node } from "../types.js"
export * from "../types.js"

type ActionRecord = {
	hash: Buffer
	signature: string

	// action payload
	app: string
	from_address: string
	session_address: string | null
	timestamp: number
	call: string
	call_args: string
	chain: Chain
	chain_id: ChainId
	block: string | null
	app_name: string
}

type SessionRecord = {
	hash: Buffer
	signature: string

	// session payload
	app: string
	from_address: string
	session_address: string
	session_duration: number
	session_issued: number
	chain: Chain
	chain_id: ChainId
	block: string | null
	app_name: string
}

type CustomActionRecord = {
	hash: Buffer
	app: string
	name: string
	payload: string
}

const toBuffer = (array: Uint8Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)

class SqliteMessageStore implements MessageStore {
	private readonly statements: Record<keyof typeof SqliteMessageStore.statements, sqlite.Statement>

	public static async initialize(
		app: string,
		directory: string | null,
		sources: Set<string> = new Set([]),
		options: { verbose?: boolean } = {}
	): Promise<SqliteMessageStore> {
		if (directory === null) {
			if (options.verbose) {
				console.log("[canvas-core] Initializing in-memory message store")
			}

			const database = new Database(":memory:")
			return new SqliteMessageStore(app, database, null, sources)
		} else {
			const databasePath = path.resolve(directory, MESSAGE_DATABASE_FILENAME)

			if (options.verbose) {
				console.log(`[canvas-core] Initializing message store at ${databasePath}`)
			}

			const database = new Database(databasePath)

			const treePath = path.resolve(directory, MST_DIRECTORY_NAME)
			if (options.verbose) {
				console.log(`[canvas-core] Initializing MST index at ${treePath}`)
			}

			const treeExists = fs.existsSync(treePath)
			if (treeExists) {
				const tree = new okra.Tree(treePath, { dbs: [app, ...sources] })
				return new SqliteMessageStore(app, database, tree, sources)
			} else {
				fs.mkdirSync(treePath)
				const tree = new okra.Tree(treePath, { dbs: [app, ...sources] })
				const messageStore = new SqliteMessageStore(app, database, tree, sources)
				for (const dbi of [app, ...sources]) {
					await tree.write(
						async (txn) => {
							for await (const [hash, message] of messageStore.getMessageStream({ app: dbi })) {
								txn.set(getMessageKey(hash, message), hash)
							}
						},
						{ dbi }
					)
				}

				return messageStore
			}
		}
	}

	private constructor(
		public readonly app: string,
		public readonly database: sqlite.Database,
		public readonly tree: okra.Tree | null,
		private readonly sources: Set<string> = new Set([])
	) {
		this.database.exec(SqliteMessageStore.createSessionsTable)
		this.database.exec(SqliteMessageStore.createActionsTable)
		this.database.exec(SqliteMessageStore.createCustomActionsTable)
		this.statements = mapEntries(SqliteMessageStore.statements, (_, sql) => this.database.prepare(sql))
	}

	public async close() {
		this.database.close()
		if (this.tree !== null) {
			this.tree.close()
		}
	}

	private insertAction(hash: Uint8Array, action: Action): void {
		assert(
			action.payload.app === this.app || this.sources.has(action.payload.app),
			"insertAction: action.payload.app not found in MessageStore.sources"
		)

		const record: ActionRecord = {
			hash: toBuffer(hash),
			signature: action.signature,
			app: action.payload.app,
			app_name: action.payload.appName,
			session_address: action.session,
			from_address: action.payload.from,
			timestamp: action.payload.timestamp,
			call: action.payload.call,
			call_args: stringify(action.payload.callArgs),
			chain: action.payload.chain,
			chain_id: action.payload.chainId,
			block: action.payload.block,
		}

		this.statements.insertAction.run(record)
	}

	private insertSession(hash: Uint8Array, session: Session): void {
		assert(
			session.payload.app === this.app || this.sources.has(session.payload.app),
			"insertSession: session.payload.app not found in MessageStore.sources"
		)

		const record: SessionRecord = {
			hash: toBuffer(hash),
			signature: session.signature,
			app: session.payload.app,
			app_name: session.payload.appName,
			from_address: session.payload.from,
			session_address: session.payload.sessionAddress,
			session_duration: session.payload.sessionDuration,
			session_issued: session.payload.sessionIssued,
			block: session.payload.block,
			chain: session.payload.chain,
			chain_id: session.payload.chainId,
		}

		this.statements.insertSession.run(record)
	}

	private insertCustomAction(hash: Uint8Array, customAction: CustomAction): void {
		assert(
			customAction.app === this.app || this.sources.has(customAction.app),
			"insertAction: action.payload.app not found in MessageStore.sources"
		)

		const record: CustomActionRecord = {
			hash: toBuffer(hash),
			app: customAction.app,
			payload: JSON.stringify(customAction.payload),
			name: customAction.name,
		}

		this.statements.insertCustomAction.run(record)
	}

	private getActionByHash(hash: Uint8Array): Action | null {
		const record: undefined | ActionRecord = this.statements.getActionByHash.get({
			hash: toBuffer(hash),
		})

		return record === undefined ? null : SqliteMessageStore.parseActionRecord(record)
	}

	private static parseActionRecord(record: ActionRecord): Action {
		const action: Action = {
			type: "action",
			signature: record.signature,
			session: record.session_address,
			payload: {
				app: record.app,
				appName: record.app_name,
				from: record.from_address,
				call: record.call,
				callArgs: JSON.parse(record.call_args) as Record<string, ActionArgument>,
				timestamp: record.timestamp,
				chain: record.chain,
				chainId: record.chain_id,
				block: record.block,
			},
		}

		return action
	}

	private getSessionByHash(hash: Uint8Array): Session | null {
		const record: undefined | SessionRecord = this.statements.getSessionByHash.get({
			hash: toBuffer(hash),
		})

		return record === undefined ? null : SqliteMessageStore.parseSessionRecord(record)
	}

	public async getSessionByAddress(
		chain: Chain,
		chainId: ChainId,
		address: string
	): Promise<[hash: string | null, session: Session | null]> {
		const record: undefined | SessionRecord = this.statements.getSessionByAddress.get({
			session_address: address,
		})

		if (record === undefined) {
			return [null, null]
		} else {
			return [toHex(record.hash), SqliteMessageStore.parseSessionRecord(record)]
		}
	}

	private static parseSessionRecord(record: SessionRecord): Session {
		return {
			type: "session",
			signature: record.signature,
			payload: {
				app: record.app,
				appName: record.app_name,
				from: record.from_address,
				sessionAddress: record.session_address,
				sessionDuration: record.session_duration,
				sessionIssued: record.session_issued,
				chain: record.chain,
				chainId: record.chain_id,
				block: record.block,
			},
		}
	}

	public async getMessageByHash(hash: Uint8Array): Promise<Message | null> {
		const session = this.getSessionByHash(hash)
		if (session !== null) {
			return session
		}

		const action = this.getActionByHash(hash)
		if (action !== null) {
			return action
		}

		const customAction = this.getCustomActionByHash(hash)
		if (customAction !== null) {
			return customAction
		}

		return null
	}

	async getCustomActionByHash(hash: Uint8Array): Promise<CustomAction | null> {
		const record: undefined | CustomActionRecord = this.statements.getCustomActionByHash.get({
			hash: toBuffer(hash),
		})

		return record === undefined ? null : SqliteMessageStore.parseCustomActionRecord(record)
	}

	private static parseCustomActionRecord(record: CustomActionRecord): CustomAction {
		return {
			type: "customAction",
			app: record.app,
			name: record.name,
			payload: JSON.parse(record.payload),
		}
	}

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public async *getMessageStream(
		filter: { type?: Message["type"]; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const { type, app } = filter
		const params = app === undefined ? {} : { app }
		if (type === undefined) {
			for (const record of this.statements.getSessions.iterate(params) as Iterable<SessionRecord>) {
				yield [record.hash, SqliteMessageStore.parseSessionRecord(record)]
			}

			for (const record of this.statements.getActions.iterate(params) as Iterable<ActionRecord>) {
				yield [record.hash, SqliteMessageStore.parseActionRecord(record)]
			}

			for (const record of this.statements.getCustomActions.iterate(params) as Iterable<CustomActionRecord>) {
				yield [record.hash, SqliteMessageStore.parseCustomActionRecord(record)]
			}
		} else if (type === "session") {
			for (const record of this.statements.getSessions.iterate(params) as Iterable<SessionRecord>) {
				yield [record.hash, SqliteMessageStore.parseSessionRecord(record)]
			}
		} else if (type === "action") {
			for (const record of this.statements.getActions.iterate(params) as Iterable<ActionRecord>) {
				yield [record.hash, SqliteMessageStore.parseActionRecord(record)]
			}
		} else if (type === "customAction") {
			for (const record of this.statements.getCustomActions.iterate(params) as Iterable<CustomActionRecord>) {
				yield [record.hash, SqliteMessageStore.parseCustomActionRecord(record)]
			}
		} else {
			signalInvalidType(type)
		}
	}

	private getReadOnlyTransaction = (txn: okra.Transaction | null): ReadOnlyTransaction => ({
		getMessage: (id) => this.getMessageByHash(id),
		getNode: async (level, key) => parseNode(assertTxn(txn).getNode(level, key)),
		getRoot: async () => parseNode(assertTxn(txn).getRoot()),
		getChildren: async (level, key) => assertTxn(txn).getChildren(level, key).map(parseNode),
		seek: async (level, key) => {
			const node = assertTxn(txn).seek(level, key)
			return node && parseNode(node)
		},
	})

	public async read<T>(callback: (txn: ReadOnlyTransaction) => T | Promise<T>, options: { dbi?: string } = {}) {
		const dbi = options.dbi ?? this.app
		assert(dbi === this.app || this.sources.has(dbi))
		if (this.tree === null) {
			return await callback(this.getReadOnlyTransaction(null))
		} else {
			return await this.tree.read((txn) => callback(this.getReadOnlyTransaction(txn)), { dbi })
		}
	}

	private getReadWriteTransaction = (txn: okra.Transaction | null): ReadWriteTransaction => ({
		...this.getReadOnlyTransaction(txn),
		insertMessage: async (id, message) => {
			if (message.type === "session") {
				this.insertSession(id, message)
			} else if (message.type === "action") {
				this.insertAction(id, message)
			} else if (message.type === "customAction") {
				this.insertCustomAction(id, message)
			} else {
				signalInvalidType(message)
			}

			if (txn !== null) {
				const key = getMessageKey(id, message)
				txn.set(key, id)
			}
		},
	})

	public async write<T>(callback: (txn: ReadWriteTransaction) => T | Promise<T>, options: { dbi?: string } = {}) {
		const dbi = options.dbi ?? this.app
		assert(dbi === this.app || this.sources.has(dbi))
		if (this.tree === null) {
			return await callback(this.getReadWriteTransaction(null))
		} else {
			return await this.tree.write((txn) => callback(this.getReadWriteTransaction(txn)), { dbi })
		}
	}

	private static createActionsTable = `CREATE TABLE IF NOT EXISTS actions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            BLOB    NOT NULL UNIQUE,
    signature       BLOB    NOT NULL,
    session_address BLOB    REFERENCES sessions(session_address),
    from_address    BLOB    NOT NULL,
    timestamp       INTEGER NOT NULL,
    call            TEXT    NOT NULL,
    call_args       BLOB    NOT NULL,
		chain           TEXT    NOT NULL,
    chain_id        TEXT    NOT NULL,
    block           BLOB,
    app             TEXT    NOT NULL,
    app_name        TEXT    NOT NULL
  );`

	private static createSessionsTable = `CREATE TABLE IF NOT EXISTS sessions (
    hash             BLOB    PRIMARY KEY,
    signature        TEXT    NOT NULL,
    from_address     TEXT    NOT NULL,
    session_address  TEXT    NOT NULL UNIQUE,
    session_duration INTEGER NOT NULL,
    session_issued   INTEGER NOT NULL,
		chain            TEXT    NOT NULL,
    chain_id         TEXT    NOT NULL,
    block            TEXT,
		app              TEXT    NOT NULL,
    app_name         TEXT    NOT NULL
  );`

	private static createCustomActionsTable = `CREATE TABLE IF NOT EXISTS custom_actions (
		hash             BLOB    PRIMARY KEY,
		name             TEXT    NOT NULL,
		payload          TEXT    NOT NULL,
		app              TEXT    NOT NULL
	);`

	private static statements = {
		insertAction: `INSERT INTO actions (
      hash, signature, session_address, from_address, timestamp, call, call_args, chain, chain_id, block, app, app_name
    ) VALUES (
      :hash, :signature, :session_address, :from_address, :timestamp, :call, :call_args, :chain, :chain_id, :block, :app, :app_name
    )`,
		insertSession: `INSERT INTO sessions (
      hash, signature, from_address, session_address, session_duration, session_issued, chain, chain_id, block, app, app_name
    ) VALUES (
      :hash, :signature, :from_address, :session_address, :session_duration, :session_issued, :chain, :chain_id, :block, :app, :app_name
    )`,
		insertCustomAction: `INSERT INTO custom_actions (
			hash, name, payload, app
		) VALUES (
			:hash, :name, :payload, :app
		)`,
		getActionByHash: `SELECT * FROM actions WHERE hash = :hash`,
		getSessionByHash: `SELECT * FROM sessions WHERE hash = :hash`,
		getCustomActionByHash: `SELECT * FROM custom_actions WHERE hash = :hash`,
		getSessionByAddress: `SELECT * FROM sessions WHERE session_address = :session_address`,
		getSessions: `SELECT * FROM sessions`,
		getActions: `SELECT * FROM actions`,
		getCustomActions: `SELECT * from custom_actions`,
		getSessionsByApp: `SELECT * FROM sessions WHERE app = :app`,
		getActionsByApp: `SELECT * FROM actions WHERE app = :app`,
		getCustomActionsByApp: `SELECT * FROM custom_actions WHERE app = :app`,
	}
}

const parseNode = ({ level, key, hash, value }: okra.Node): Node =>
	value ? { level, key, hash, id: value } : { level, key, hash }

function assertTxn(txn: okra.Transaction | null): okra.Transaction {
	if (txn === null) {
		throw new Error("cannot access MST on an in-memory message store")
	} else {
		return txn
	}
}

export const openMessageStore = (
	app: string,
	directory: string | null,
	sources: Set<string> = new Set([]),
	options: { verbose?: boolean } = {}
): Promise<MessageStore> => SqliteMessageStore.initialize(app, directory, sources, options)
