import path from "node:path"
import fs from "node:fs"

import Database, * as sqlite from "better-sqlite3"
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"
import * as okra from "@canvas-js/okra-node"

import type { Action, Session, ActionArgument, CustomAction, Message } from "@canvas-js/interfaces"

import { mapEntries, toHex, stringify, signalInvalidType, assert } from "@canvas-js/core/utils"
import { MESSAGE_DATABASE_FILENAME, MST_DIRECTORY_NAME } from "@canvas-js/core/constants"

import { getMessageKey } from "@canvas-js/core/sync"

import type { MessageStore, ReadOnlyTransaction, ReadWriteTransaction, Node, MessageStoreEvents } from "../types.js"

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
	chain: string
	block: string | null
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
	chain: string
	block: string | null
}

type CustomActionRecord = {
	hash: Buffer
	app: string
	name: string
	payload: string
}

const toBuffer = (array: Uint8Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)

class SqliteMessageStore extends EventEmitter<MessageStoreEvents> implements MessageStore {
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

				const store = new SqliteMessageStore(app, database, tree, sources)

				for (const dbi of [app, ...sources]) {
					const { hash } = await tree.read((txn) => txn.getRoot(), { dbi })
					store.merkleRoots[dbi] = toHex(hash)
				}

				return store
			} else {
				fs.mkdirSync(treePath)
				const tree = new okra.Tree(treePath, { dbs: [app, ...sources] })
				const store = new SqliteMessageStore(app, database, tree, sources)
				for (const dbi of [app, ...sources]) {
					const { hash } = await tree.write(
						async (txn) => {
							for await (const [hash, message] of store.getMessageStream({ app: dbi })) {
								txn.set(getMessageKey(hash, message), hash)
							}

							return txn.getRoot()
						},
						{ dbi }
					)

					store.merkleRoots[dbi] = toHex(hash)
				}

				return store
			}
		}
	}

	private readonly statements: Record<keyof typeof SqliteMessageStore.statements, sqlite.Statement>
	private readonly merkleRoots: Record<string, string> = {}

	private constructor(
		public readonly app: string,
		public readonly database: sqlite.Database,
		public readonly tree: okra.Tree | null,
		private readonly sources: Set<string> = new Set([])
	) {
		super()
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
			session_address: action.session,
			from_address: action.payload.from,
			timestamp: action.payload.timestamp,
			call: action.payload.call,
			call_args: stringify(action.payload.callArgs),
			chain: action.payload.chain,
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
			from_address: session.payload.from,
			session_address: session.payload.sessionAddress,
			session_duration: session.payload.sessionDuration,
			session_issued: session.payload.sessionIssued,
			block: session.payload.block,
			chain: session.payload.chain,
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

	public getMerkleRoots(): Record<string, string> {
		return this.merkleRoots
	}

	private getSessionByAddress(chain: string, address: string): [hash: string | null, session: Session | null] {
		const record: undefined | SessionRecord = this.statements.getSessionByAddress.get({
			session_address: address,
		})

		if (record === undefined) {
			return [null, null]
		} else {
			return [toHex(record.hash), SqliteMessageStore.parseSessionRecord(record)]
		}
	}

	private getMessageByHash(hash: Uint8Array): Message | null {
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

	private getSessionByHash(hash: Uint8Array): Session | null {
		const record: undefined | SessionRecord = this.statements.getSessionByHash.get({
			hash: toBuffer(hash),
		})

		return record === undefined ? null : SqliteMessageStore.parseSessionRecord(record)
	}

	private getActionByHash(hash: Uint8Array): Action | null {
		const record: undefined | ActionRecord = this.statements.getActionByHash.get({
			hash: toBuffer(hash),
		})

		return record === undefined ? null : SqliteMessageStore.parseActionRecord(record)
	}

	private getCustomActionByHash(hash: Uint8Array): CustomAction | null {
		const record: undefined | CustomActionRecord = this.statements.getCustomActionByHash.get({
			hash: toBuffer(hash),
		})

		return record === undefined ? null : SqliteMessageStore.parseCustomActionRecord(record)
	}

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public async *getMessageStream(
		filter: { type?: Message["type"]; limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const { type, limit, app } = filter
		if (type === undefined) {
			const countMax = limit ?? Infinity
			let count = 0
			for await (const session of this.getSessionStream({ limit, app })) {
				if (count++ < countMax) {
					yield session
				}
			}

			for await (const session of this.getActionStream({ limit, app })) {
				if (count++ < countMax) {
					yield session
				}
			}

			for await (const session of this.getCustomActionStream({ limit, app })) {
				if (count++ < countMax) {
					yield session
				}
			}
		} else if (type === "session") {
			yield* this.getSessionStream({ limit, app })
		} else if (type === "action") {
			yield* this.getActionStream({ limit, app })
		} else if (type === "customAction") {
			yield* this.getCustomActionStream({ limit, app })
		} else {
			signalInvalidType(type)
		}
	}

	private async *getSessionStream(filter: { limit?: number; app?: string } = {}): AsyncIterable<[Uint8Array, Message]> {
		const limit = filter.limit ?? -1
		if (filter.app) {
			for (const record of this.statements.getSessionsByApp.iterate({ app: filter.app, limit })) {
				yield [record.hash, SqliteMessageStore.parseSessionRecord(record)]
			}
		} else {
			for (const record of this.statements.getSessions.iterate({ limit })) {
				yield [record.hash, SqliteMessageStore.parseSessionRecord(record)]
			}
		}
	}

	private async *getActionStream(filter: { limit?: number; app?: string } = {}): AsyncIterable<[Uint8Array, Message]> {
		const limit = filter.limit ?? -1
		if (filter.app) {
			for (const record of this.statements.getActionsByApp.iterate({ app: filter.app, limit })) {
				yield [record.hash, SqliteMessageStore.parseActionRecord(record)]
			}
		} else {
			for (const record of this.statements.getActions.iterate({ limit })) {
				yield [record.hash, SqliteMessageStore.parseActionRecord(record)]
			}
		}
	}

	private async *getCustomActionStream(
		filter: { limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const limit = filter.limit ?? -1
		if (filter.app) {
			for (const record of this.statements.getCustomActionsByApp.iterate({ app: filter.app, limit })) {
				yield [record.hash, SqliteMessageStore.parseCustomActionRecord(record)]
			}
		} else {
			for (const record of this.statements.getCustomActions.iterate({ limit })) {
				yield [record.hash, SqliteMessageStore.parseCustomActionRecord(record)]
			}
		}
	}

	private getReadOnlyTransaction = (uri: string, txn: okra.ReadOnlyTransaction | null): ReadOnlyTransaction => ({
		uri,
		getSessionByAddress: async (chain, address) => this.getSessionByAddress(chain, address),
		getMessage: async (id) => this.getMessageByHash(id),
		getNode: async (level, key) => parseNode(assertTxn(txn).getNode(level, key)),
		getRoot: async () => parseNode(assertTxn(txn).getRoot()),
		getChildren: async (level, key) => assertTxn(txn).getChildren(level, key).map(parseNode),
		seek: async (level, key) => {
			const node = assertTxn(txn).seek(level, key)
			return node && parseNode(node)
		},
	})

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))
		if (this.tree === null) {
			return await callback(this.getReadOnlyTransaction(uri, null))
		} else {
			return await this.tree.read((txn) => callback(this.getReadOnlyTransaction(uri, txn)), { dbi: uri })
		}
	}

	private getReadWriteTransaction = (uri: string, txn: okra.ReadWriteTransaction | null): ReadWriteTransaction => ({
		...this.getReadOnlyTransaction(uri, txn),
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

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))

		let result: T | undefined = undefined
		if (this.tree === null) {
			result = await callback(this.getReadWriteTransaction(uri, null))
		} else {
			const root = await this.tree.write(
				async (txn) => {
					result = await callback(this.getReadWriteTransaction(uri, txn))
					return txn.getRoot()
				},
				{ dbi: uri }
			)

			this.merkleRoots[uri] = toHex(root.hash)
		}

		this.dispatchEvent(new CustomEvent("update", { detail: { uri, root: this.merkleRoots[uri] ?? null } }))
		return result!
	}

	private static parseSessionRecord(record: SessionRecord): Session {
		return {
			type: "session",
			signature: record.signature,
			payload: {
				app: record.app,
				from: record.from_address,
				sessionAddress: record.session_address,
				sessionDuration: record.session_duration,
				sessionIssued: record.session_issued,
				chain: record.chain,
				block: record.block,
			},
		}
	}

	private static parseActionRecord(record: ActionRecord): Action {
		const action: Action = {
			type: "action",
			signature: record.signature,
			session: record.session_address,
			payload: {
				app: record.app,
				from: record.from_address,
				call: record.call,
				callArgs: JSON.parse(record.call_args) as Record<string, ActionArgument>,
				timestamp: record.timestamp,
				chain: record.chain,
				block: record.block,
			},
		}

		return action
	}

	private static parseCustomActionRecord(record: CustomActionRecord): CustomAction {
		return {
			type: "customAction",
			app: record.app,
			name: record.name,
			payload: JSON.parse(record.payload),
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
    block           BLOB,
    app             TEXT    NOT NULL
  );`

	private static createSessionsTable = `CREATE TABLE IF NOT EXISTS sessions (
    hash             BLOB    PRIMARY KEY,
    signature        TEXT    NOT NULL,
    from_address     TEXT    NOT NULL,
    session_address  TEXT    NOT NULL UNIQUE,
    session_duration INTEGER NOT NULL,
    session_issued   INTEGER NOT NULL,
		chain            TEXT    NOT NULL,
    block            TEXT,
		app              TEXT    NOT NULL
  );`

	private static createCustomActionsTable = `CREATE TABLE IF NOT EXISTS custom_actions (
		hash             BLOB    PRIMARY KEY,
		name             TEXT    NOT NULL,
		payload          TEXT    NOT NULL,
		app              TEXT    NOT NULL
	);`

	private static statements = {
		insertAction: `INSERT INTO actions (
      hash, signature, session_address, from_address, timestamp, call, call_args, chain, block, app
    ) VALUES (
      :hash, :signature, :session_address, :from_address, :timestamp, :call, :call_args, :chain, :block, :app
    )`,
		insertSession: `INSERT INTO sessions (
      hash, signature, from_address, session_address, session_duration, session_issued, chain, block, app
    ) VALUES (
      :hash, :signature, :from_address, :session_address, :session_duration, :session_issued, :chain, :block, :app
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
		getSessions: `SELECT * FROM sessions LIMIT :limit`,
		getActions: `SELECT * FROM actions LIMIT :limit`,
		getCustomActions: `SELECT * from custom_actions LIMIT :limit`,
		getSessionsByApp: `SELECT * FROM sessions WHERE app = :app`,
		getActionsByApp: `SELECT * FROM actions WHERE app = :app`,
		getCustomActionsByApp: `SELECT * FROM custom_actions WHERE app = :app`,
	}
}

const parseNode = ({ level, key, hash, value }: okra.Node): Node =>
	value ? { level, key, hash, id: value } : { level, key, hash }

function assertTxn(txn: okra.ReadOnlyTransaction | null): okra.ReadOnlyTransaction {
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
