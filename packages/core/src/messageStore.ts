import assert from "node:assert"
import Database, * as sqlite from "better-sqlite3"
import * as cbor from "microcbor"

import type { Action, Session, ActionArgument, Chain, ChainId } from "@canvas-js/interfaces"

import { mapEntries, fromHex, toHex, toBuffer } from "./utils.js"
import { BinaryAction, BinarySession, fromBinaryAction, fromBinarySession } from "./encoding.js"
import { encodeAddress } from "./chains/index.js"

type ActionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer | null
	timestamp: number
	blocknum: number | null
	blockhash: Buffer | null
	call: string
	args: Buffer
	chain: Chain
	chain_id: ChainId
}

type SessionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer
	duration: number
	timestamp: number
	blocknum: number | null
	blockhash: Buffer | null
	chain: Chain
	chain_id: ChainId
}

/**
 * The message log archives messages in its own separate SQLite database.
 */

export class MessageStore {
	public readonly database: sqlite.Database
	private readonly statements: Record<keyof typeof MessageStore.statements, sqlite.Statement>

	constructor(public readonly uri: string, path: string | null, options: { verbose?: boolean } = {}) {
		if (path === null) {
			if (options.verbose) {
				console.log("[canvas-core] Initializing in-memory message store")
			}

			this.database = new Database(":memory:")
		} else {
			if (options.verbose) {
				console.log(`[canvas-core] Initializing message store at ${path}`)
			}

			this.database = new Database(path)
		}

		this.database.exec(MessageStore.createSessionsTable)
		this.database.exec(MessageStore.createActionsTable)

		this.statements = mapEntries(MessageStore.statements, (_, sql) => this.database.prepare(sql))
	}

	public close() {
		this.database.close()
	}

	public insertAction(hash: string | Buffer, action: BinaryAction) {
		assert(action.payload.spec === this.uri, "insertAction: action.payload.spec did not match MessageStore.name")

		const record: ActionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: toBuffer(action.signature),
			session_address: action.session ? toBuffer(action.session) : null,
			from_address: toBuffer(action.payload.from),
			timestamp: action.payload.timestamp,
			call: action.payload.call,
			args: toBuffer(cbor.encode(action.payload.args)),
			blockhash: action.payload.blockhash ? toBuffer(action.payload.blockhash) : null,
			chain: action.payload.chain,
			chain_id: action.payload.chainId,
		}

		this.statements.insertAction.run(record)
	}

	public insertSession(hash: string | Buffer, session: BinarySession) {
		assert(session.payload.spec === this.uri, "insertSession: session.payload.spec did not match MessageStore.uri")

		const record: SessionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: toBuffer(session.signature),
			from_address: toBuffer(session.payload.from),
			session_address: toBuffer(session.payload.address),
			duration: session.payload.duration,
			timestamp: session.payload.timestamp,
			blockhash: session.payload.blockhash ? toBuffer(session.payload.blockhash) : null,
			chain: session.payload.chain,
			chain_id: session.payload.chainId,
		}

		this.statements.insertSession.run(record)
	}

	public getActionByHash(hash: Buffer): BinaryAction | null {
		const record: undefined | ActionRecord = this.statements.getActionByHash.get({ hash })
		return record === undefined ? null : this.parseActionRecord(record)
	}

	private parseActionRecord(record: ActionRecord): BinaryAction {
		const action: BinaryAction = {
			type: "action",
			signature: record.signature,
			session: record.session_address,
			payload: {
				spec: this.uri,
				from: record.from_address,
				call: record.call,
				args: cbor.decode(record.args) as Record<string, ActionArgument>,
				timestamp: record.timestamp,
				chain: record.chain,
				chainId: record.chain_id,
				blockhash: record.blockhash,
			},
		}

		return action
	}

	public getSessionByHash(hash: Buffer | string): BinarySession | null {
		const record: undefined | SessionRecord = this.statements.getSessionByHash.get({
			hash: typeof hash === "string" ? fromHex(hash) : hash,
		})

		return record === undefined ? null : this.parseSessionRecord(record)
	}

	public getSessionByAddress(
		chain: Chain,
		chainId: ChainId,
		address: string
	): { hash: null; session: null } | { hash: string; session: BinarySession } {
		const record: undefined | SessionRecord = this.statements.getSessionByAddress.get({
			session_address: toBuffer(encodeAddress(chain, chainId, address)),
		})

		if (record === undefined) {
			return { hash: null, session: null }
		} else {
			return { hash: toHex(record.hash), session: this.parseSessionRecord(record) }
		}
	}

	private parseSessionRecord(record: SessionRecord): BinarySession {
		const session: BinarySession = {
			type: "session",
			signature: record.signature,
			payload: {
				spec: this.uri,
				from: record.from_address,
				timestamp: record.timestamp,
				address: record.session_address,
				duration: record.duration,
				chain: record.chain,
				chainId: record.chain_id,
				blockhash: record.blockhash,
			},
		}

		return session
	}

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public *getActionStream(): Iterable<[string, Action]> {
		for (const record of this.statements.getActions.iterate({}) as Iterable<ActionRecord>) {
			yield [toHex(record.hash), fromBinaryAction(this.parseActionRecord(record))]
		}
	}

	public *getSessionStream(): Iterable<[string, Session]> {
		for (const record of this.statements.getSessions.iterate({}) as Iterable<SessionRecord>) {
			yield [toHex(record.hash), fromBinarySession(this.parseSessionRecord(record))]
		}
	}

	private static createActionsTable = `CREATE TABLE IF NOT EXISTS actions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            BLOB    NOT NULL UNIQUE,
    signature       BLOB    NOT NULL,
    session_address BLOB    REFERENCES sessions(session_address),
    from_address    BLOB    NOT NULL,
    timestamp       INTEGER NOT NULL,
    blockhash       BLOB            ,
		chain           TEXT    NOT NULL,
    chain_id        INTEGER NOT NULL,
    call            TEXT    NOT NULL,
    args            BLOB    NOT NULL
  );`

	private static createSessionsTable = `CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            BLOB    NOT NULL UNIQUE,
    signature       BLOB    NOT NULL,
    from_address    BLOB    NOT NULL,
    session_address BLOB    NOT NULL UNIQUE,
    duration        INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
    blockhash       BLOB            ,
		chain           TEXT    NOT NULL,
    chain_id        INTEGER NOT NULL
  );`

	private static statements = {
		insertAction: `INSERT INTO actions (
      hash, signature, session_address, from_address, timestamp, blockhash, call, args, chain, chain_id
    ) VALUES (
      :hash, :signature, :session_address, :from_address, :timestamp, :blockhash, :call, :args, :chain, :chain_id
    )`,
		insertSession: `INSERT INTO sessions (
      hash, signature, from_address, session_address, duration, timestamp, blockhash, chain, chain_id
    ) VALUES (
      :hash, :signature, :from_address, :session_address, :duration, :timestamp, :blockhash, :chain, :chain_id
    )`,
		getActionByHash: `SELECT * FROM actions WHERE hash = :hash`,
		getSessionByHash: `SELECT * FROM sessions WHERE hash = :hash`,
		getSessionByAddress: `SELECT * FROM sessions WHERE session_address = :session_address`,
		getSessions: `SELECT * FROM sessions`,
		getActions: `SELECT * FROM actions`,
	}
}
