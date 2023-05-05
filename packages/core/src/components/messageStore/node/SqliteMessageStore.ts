import path from "node:path"
import fs from "node:fs"

import Database, * as sqlite from "better-sqlite3"
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import * as okra from "@canvas-js/okra-node"

import type { Message, Session } from "@canvas-js/interfaces"

import { getMessageKey } from "@canvas-js/core/sync"
import { MESSAGE_DATABASE_FILENAME, MST_DIRECTORY_NAME } from "@canvas-js/core/constants"
import { mapEntries, toHex, assert } from "@canvas-js/core/utils"

import type { MessageStore, MessageStoreEvents, ReadOnlyTransaction, ReadWriteTransaction } from "../types.js"

type MessageRecord = { hash: Buffer; type: string; message: string }
type SessionHashRecord = { session_address: string; hash: Buffer }

const toBuffer = (array: Uint8Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)

export class SqliteMessageStore extends EventEmitter<MessageStoreEvents> implements MessageStore {
	public static async initialize(
		app: string,
		directory: string,
		sources: Set<string> = new Set([]),
		options: { verbose?: boolean } = {}
	): Promise<SqliteMessageStore> {
		const databasePath = path.resolve(directory, MESSAGE_DATABASE_FILENAME)
		if (options.verbose) {
			console.log(`[canvas-core] Opening message store at ${databasePath}`)
		}

		const database = new Database(databasePath)

		const treePath = path.resolve(directory, MST_DIRECTORY_NAME)
		if (options.verbose) {
			console.log(`[canvas-core] Opening message index at ${treePath}`)
		}

		if (fs.existsSync(treePath)) {
			const tree = new okra.Tree(treePath, { dbs: [app, ...sources] })
			const store = new SqliteMessageStore(app, database, tree, sources)

			for (const dbi of [app, ...sources]) {
				const { hash } = await tree.read((txn) => txn.getRoot(), { dbi })
				store.merkleRoots[dbi] = toHex(hash)
			}

			return store
		} else {
			const tree = new okra.Tree(treePath, { dbs: [app, ...sources] })
			const store = new SqliteMessageStore(app, database, tree, sources)

			for (const uri of [app, ...sources]) {
				await tree.write(
					async (txn) => {
						for await (const [hash, message] of store.getMessageStream({ app: uri })) {
							const key = getMessageKey(hash, message)
							txn.set(key, hash)
						}

						const root = txn.getRoot()
						store.merkleRoots[uri] = toHex(root.hash)
					},
					{ dbi: uri }
				)
			}

			return store
		}
	}

	private readonly statements: Record<keyof typeof SqliteMessageStore.statements, sqlite.Statement>
	private readonly merkleRoots: Record<string, string> = {}

	private constructor(
		public readonly app: string,
		public readonly database: sqlite.Database,
		public readonly tree: okra.Tree,
		private readonly sources: Set<string> = new Set([])
	) {
		super()
		this.database.exec(SqliteMessageStore.createMessagesTable)
		this.database.exec(SqliteMessageStore.createSessionHashTable)
		this.statements = mapEntries(SqliteMessageStore.statements, (_, sql) => this.database.prepare(sql))
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

	private async getSessionByAddress(
		chain: string,
		address: string
	): Promise<[hash: string | null, session: Session | null]> {
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
			return [toHex(record.hash), JSON.parse(record.message) as Session]
		}
	}

	private getMessageByHash(hash: Uint8Array): Message | null {
		const record = this.statements.getMessageByHash.get({
			hash: toBuffer(hash),
		}) as undefined | MessageRecord
		if (record === undefined) {
			return null
		} else {
			return JSON.parse(record.message) as Message
		}
	}

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public async *getMessageStream(
		filter: { type?: Message["type"]; limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const { type, limit } = filter

		const offset = 0

		let iter: Iterable<MessageRecord>

		// i wish we had a query builder
		// whatever, this is fine
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

		for (const record of iter as Iterable<MessageRecord>) {
			yield [record.hash, JSON.parse(record.message) as Message]
		}
	}

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))
		return await this.tree.read(
			(txn) =>
				callback({
					uri,
					source: txn,
					getMessage: async (id) => this.getMessageByHash(id),
					getSessionByAddress: async (chain, address) => this.getSessionByAddress(chain, address),
				}),
			{ dbi: uri }
		)
	}

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))

		const result = await this.tree.write(
			async (txn) => {
				const result = await callback({
					uri,
					target: txn,
					getMessage: async (id) => this.getMessageByHash(id),
					getSessionByAddress: async (chain, address) => this.getSessionByAddress(chain, address),
					insertMessage: async (id, message) => {
						this.statements.insertMessage.run({
							hash: id,
							type: message.type,
							message: JSON.stringify(message),
						})

						if (message.type === "session") {
							this.statements.insertSessionHash.run({ hash: id, session_address: message.payload.sessionAddress })
						}

						const key = getMessageKey(id, message)
						txn.set(key, id)
					},
				})

				const root = txn.getRoot()
				this.merkleRoots[uri] = toHex(root.hash)

				return result
			},
			{ dbi: uri }
		)

		this.dispatchEvent(new CustomEvent("update", { detail: { uri, root: this.merkleRoots[uri] ?? null } }))
		return result!
	}

	// This table stores messages (actions, sessions, customActions)
	// The `message` field is a JSON blob
	private static createMessagesTable = `CREATE TABLE IF NOT EXISTS messages (
		hash      BLOB PRIMARY KEY,
		type      TEXT NOT NULL,
		message   BLOB NOT NULL
	)`

	private static createSessionHashTable = `CREATE TABLE IF NOT EXISTS session_hash (
		session_address   TEXT PRIMARY KEY,
		hash              BLOB NOT NULL
	)`

	private static statements = {
		insertSessionHash: `INSERT INTO session_hash (session_address, hash) VALUES (:session_address, :hash)`,
		getSessionHashBySessionAddress: `SELECT * FROM session_hash WHERE session_address = :session_address`,
		insertMessage: `INSERT INTO messages (hash, type, message) VALUES (:hash, :type, :message)`,
		getMessageByHash: `SELECT * FROM messages WHERE hash = :hash`,
		getMessages: `SELECT * FROM messages`,
		getMessagesByType: `SELECT * FROM messages WHERE type = :type`,
		getMessagesWithLimitOffset: `SELECT * FROM messages LIMIT :limit OFFSET :offset`,
		getMessagesByTypeWithLimitOffset: `SELECT * FROM messages WHERE type = :type LIMIT :limit OFFSET :offset`,
	}
}
