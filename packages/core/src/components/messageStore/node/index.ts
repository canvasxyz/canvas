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

type MessageRecord = {
	hash: Buffer
	type: string
	payload: string
}

type SessionHashRecord = {
	hash: Buffer
	session_address: string
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
		this.database.exec(SqliteMessageStore.createMessagesTable)
		this.database.exec(SqliteMessageStore.createSessionHashTable)
		this.statements = mapEntries(SqliteMessageStore.statements, (_, sql) => {
			console.log(sql)
			return this.database.prepare(sql)
		})
	}

	public async close() {
		this.database.close()
		if (this.tree !== null) {
			this.tree.close()
		}
	}

	public getMerkleRoots(): Record<string, string> {
		return this.merkleRoots
	}

	private getSessionByAddress(chain: string, address: string): [hash: string | null, session: Session | null] {
		const sessionHashRecord = this.statements.getSessionHashBySessionAddress.get({ session_address: address }) as
			| undefined
			| SessionHashRecord

		if (sessionHashRecord === undefined) {
			return [null, null]
		}

		const hash = sessionHashRecord.hash
		const record = this.statements.getMessageByHash.get({
			hash,
		}) as undefined | MessageRecord

		if (record === undefined || record.type !== "session") {
			return [null, null]
		} else {
			return [toHex(record.hash), JSON.parse(record.payload) as Session]
		}
	}

	private getMessageByHash(hash: Uint8Array): Message | null {
		const record = this.statements.getMessageByHash.get({
			hash: toBuffer(hash),
		}) as undefined | MessageRecord
		if (record === undefined) {
			return null
		} else {
			return JSON.parse(record.payload) as Message
		}
	}

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public async *getMessageStream(
		filter: { type?: Message["type"]; limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const { type, limit, app } = filter

		const offset = 0

		let iter: Iterable<MessageRecord>

		// i wish we had a query builder
		// whatever, this is fine
		if (app === undefined) {
			if (limit === undefined) {
				// unpaginated
				if (type === undefined) {
					iter = this.statements.getMessages.iterate() as Iterable<MessageRecord>
				} else {
					iter = this.statements.getMessagesByType.iterate({ type }) as Iterable<MessageRecord>
				}
			} else {
				if (type === undefined) {
					iter = this.statements.getMessagesWithLimitOffset.iterate({ limit, offset }) as Iterable<MessageRecord>
				} else {
					iter = this.statements.getMessagesByTypeWithLimitOffset.iterate({
						type,
						limit,
						offset,
					}) as Iterable<MessageRecord>
				}
			}
		} else {
			if (limit === undefined) {
				// unpaginated
				if (type === undefined) {
					iter = this.statements.getMessagesByApp.iterate({ app }) as Iterable<MessageRecord>
				} else {
					iter = this.statements.getMessagesByAppAndType.iterate({ type, app }) as Iterable<MessageRecord>
				}
			} else {
				// paginated
				const offset = 0
				if (type === undefined) {
					iter = this.statements.getMessagesByAppWithLimitOffset.iterate({
						app,
						limit,
						offset,
					}) as Iterable<MessageRecord>
				} else {
					iter = this.statements.getMessagesByAppAndTypeWithLimitOffset.iterate({
						app,
						type,
						limit,
						offset,
					}) as Iterable<MessageRecord>
				}
			}
		}
		for (const record of iter as Iterable<MessageRecord>) {
			yield [record.hash, JSON.parse(record.payload) as Message]
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
			this.statements.insertMessage.run({
				hash: id,
				app: message.payload.app,
				type: message.type,
				payload: JSON.stringify(message),
			})

			if (message.type === "session") {
				this.statements.insertSessionHash.run({ hash: id, session_address: message.payload.sessionAddress })
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

	// This table stores messages (actions, sessions, customActions)
	// The `payload` field is a JSON blob
	private static createMessagesTable = `CREATE TABLE IF NOT EXISTS messages (
		hash      BLOB PRIMARY KEY,
		app       TEXT NOT NULL,
		type      TEXT NOT NULL,
		payload   BLOB NOT NULL
	)`

	private static createSessionHashTable = `CREATE TABLE IF NOT EXISTS session_hash (
		session_address   TEXT PRIMARY KEY,
		hash              BLOB NOT NULL
	)`

	private static statements = {
		insertSessionHash: `INSERT INTO session_hash (session_address, hash) VALUES (:session_address, :hash)`,
		getSessionHashBySessionAddress: `SELECT * FROM session_hash WHERE session_address = :session_address`,
		insertMessage: `INSERT INTO messages (hash, app, type, payload) VALUES (:hash, :app, :type, :payload)`,
		getMessageByHash: `SELECT * FROM messages WHERE hash = :hash`,
		getMessages: `SELECT * FROM messages`,
		getMessagesByApp: `SELECT * FROM messages WHERE app = :app`,
		getMessagesByType: `SELECT * FROM messages WHERE type = :type`,
		getMessagesWithLimitOffset: `SELECT * FROM messages LIMIT :limit OFFSET :offset`,
		getMessagesByAppAndType: `SELECT * FROM messages WHERE type = :type`,
		getMessagesByAppWithLimitOffset: `SELECT * FROM messages WHERE app = :app LIMIT :limit OFFSET :offset`,
		getMessagesByTypeWithLimitOffset: `SELECT * FROM messages WHERE type = :type LIMIT :limit OFFSET :offset`,
		getMessagesByAppAndTypeWithLimitOffset: `SELECT * FROM messages WHERE type = :type LIMIT :limit OFFSET :offset`,
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
