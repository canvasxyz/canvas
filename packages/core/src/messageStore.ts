import assert from "node:assert"
import toBuffer from "typedarray-to-buffer"
import Database, * as sqlite from "better-sqlite3"
import * as cbor from "microcbor"
import { decodeAddress } from "@polkadot/keyring"

import type { Action, Session, ActionArgument, Chain, ChainId } from "@canvas-js/interfaces"

import { mapEntries, fromHex, toHex } from "./utils.js"

type ActionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer | null
	timestamp: number
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

	public insertAction(hash: string | Buffer, action: Action) {
		assert(action.payload.spec === this.uri, "insertAction: action.payload.spec did not match MessageStore.name")

		const args = cbor.encode(action.payload.args)

		const record: ActionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: fromHex(action.signature),
			session_address: null,
			from_address: fromHex(action.payload.from),
			timestamp: action.payload.timestamp,
			call: action.payload.call,
			args: Buffer.from(args.buffer, args.byteOffset, args.byteLength),
			blockhash: action.payload.blockhash ? fromHex(action.payload.blockhash) : null,
			chain: action.payload.chain,
			chain_id: action.payload.chainId,
		}

		if (action.session !== null) {
			record.session_address = fromHex(action.session)
		}

		this.statements.insertAction.run(record)
	}

	public insertSession(hash: string | Buffer, session: Session) {
		const isSubstrate = session.payload.chain == "substrate"

		assert(session.payload.spec === this.uri, "insertSession: session.payload.spec did not match MessageStore.uri")

		const decode = session.payload.chain == "substrate" ? (value: string) => toBuffer(decodeAddress(value)) : fromHex

		const record: SessionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: decode(session.signature),
			from_address: decode(session.payload.from),
			session_address: decode(session.payload.address),
			duration: session.payload.duration,
			timestamp: session.payload.timestamp,
			blockhash: session.payload.blockhash ? decode(session.payload.blockhash) : null,
			chain: session.payload.chain,
			chain_id: session.payload.chainId,
		}

		console.log(record)
		this.statements.insertSession.run(record)
	}

	public getActionByHash(hash: string | Buffer): Action | null {
		const record: undefined | ActionRecord = this.statements.getActionByHash.get({
			hash: typeof hash === "string" ? fromHex(hash) : hash,
		})

		return record === undefined ? null : this.parseActionRecord(record)
	}

	private parseActionRecord(record: ActionRecord): Action {
		const action: Action = {
			signature: toHex(record.signature),
			session: record.session_address && toHex(record.session_address),
			payload: {
				spec: this.uri,
				from: toHex(record.from_address),
				call: record.call,
				args: cbor.decode(record.args) as ActionArgument[],
				timestamp: record.timestamp,
				chain: record.chain,
				chainId: record.chain_id,
				blockhash: record.blockhash ? toHex(record.blockhash) : null,
			},
		}

		return action
	}

	public getSessionByHash(hash: Buffer | string): Session | null {
		const record: undefined | SessionRecord = this.statements.getSessionByHash.get({
			hash: typeof hash === "string" ? fromHex(hash) : hash,
		})

		return record === undefined ? null : this.parseSessionRecord(record)
	}

	public getSessionByAddress(address: string): { hash: null; session: null } | { hash: string; session: Session } {
		const record: undefined | SessionRecord = this.statements.getSessionByAddress.get({
			session_address: fromHex(address),
		})

		if (record === undefined) {
			return { hash: null, session: null }
		} else {
			return { hash: toHex(record.hash), session: this.parseSessionRecord(record) }
		}
	}

	private parseSessionRecord(record: SessionRecord): Session {
		const session: Session = {
			signature: toHex(record.signature),
			payload: {
				spec: this.uri,
				from: toHex(record.from_address),
				timestamp: record.timestamp,
				address: toHex(record.session_address),
				duration: record.duration,
				chain: record.chain,
				chainId: record.chain_id,
				blockhash: record.blockhash ? toHex(record.blockhash) : null,
			},
		}

		return session
	}

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public *getActionStream(): Iterable<[string, Action]> {
		for (const record of this.statements.getActions.iterate({}) as Iterable<ActionRecord>) {
			yield [toHex(record.hash), this.parseActionRecord(record)]
		}
	}

	public *getSessionStream(): Iterable<[string, Session]> {
		for (const record of this.statements.getSessions.iterate({}) as Iterable<SessionRecord>) {
			yield [toHex(record.hash), this.parseSessionRecord(record)]
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
