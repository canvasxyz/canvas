import assert from "node:assert"
import Database, * as sqlite from "better-sqlite3"

import type { Action, Session, ActionArgument, Chain, ChainId, Message } from "@canvas-js/interfaces"

import { mapEntries, fromHex, toHex, signalInvalidType, stringify } from "./utils.js"

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

/**
 * The message log archives messages in its own separate SQLite database.
 */
export class MessageStore {
	public readonly database: sqlite.Database
	private readonly statements: Record<keyof typeof MessageStore.statements, sqlite.Statement>

	constructor(
		private readonly app: string,
		private readonly path: string | null,
		private readonly sources: Set<string> = new Set([]),
		private readonly options: { verbose?: boolean } = {}
	) {
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

	public insert(hash: string | Buffer, message: Message) {
		if (message.type === "action") {
			this.insertAction(hash, message)
		} else if (message.type === "session") {
			this.insertSession(hash, message)
		} else {
			signalInvalidType(message)
		}
	}

	public insertAction(hash: string | Buffer, action: Action) {
		assert(
			action.payload.app === this.app || this.sources.has(action.payload.app),
			"insertAction: action.payload.app not found in MessageStore.sources"
		)

		const record: ActionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
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

	public insertSession(hash: string | Buffer, session: Session) {
		assert(
			session.payload.app === this.app || this.sources.has(session.payload.app),
			"insertSession: session.payload.app not found in MessageStore.sources"
		)

		const record: SessionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
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

	public getActionByHash(hash: Buffer): Action | null {
		const record: undefined | ActionRecord = this.statements.getActionByHash.get({ hash })
		return record === undefined ? null : MessageStore.parseActionRecord(record)
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

	public getSessionByHash(hash: Buffer | string): Session | null {
		const record: undefined | SessionRecord = this.statements.getSessionByHash.get({
			hash: typeof hash === "string" ? fromHex(hash) : hash,
		})

		return record === undefined ? null : MessageStore.parseSessionRecord(record)
	}

	public getSessionByAddress(
		chain: Chain,
		chainId: ChainId,
		address: string
	): { hash: null; session: null } | { hash: string; session: Session } {
		const record: undefined | SessionRecord = this.statements.getSessionByAddress.get({ session_address: address })

		if (record === undefined) {
			return { hash: null, session: null }
		} else {
			return { hash: toHex(record.hash), session: MessageStore.parseSessionRecord(record) }
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

	// we can use statement.iterate() instead of paging manually
	// https://github.com/WiseLibs/better-sqlite3/issues/406
	public *getActionStream({ app }: { app?: string } = {}): Iterable<[string, Action]> {
		if (app === undefined) {
			for (const record of this.statements.getActions.iterate({}) as Iterable<ActionRecord>) {
				yield [toHex(record.hash), MessageStore.parseActionRecord(record)]
			}
		} else {
			for (const record of this.statements.getActionsByApp.iterate({ app }) as Iterable<ActionRecord>) {
				yield [toHex(record.hash), MessageStore.parseActionRecord(record)]
			}
		}
	}

	public *getSessionStream({ app }: { app?: string } = {}): Iterable<[string, Session]> {
		if (app === undefined) {
			for (const record of this.statements.getSessions.iterate({}) as Iterable<SessionRecord>) {
				yield [toHex(record.hash), MessageStore.parseSessionRecord(record)]
			}
		} else {
			for (const record of this.statements.getSessionsByApp.iterate({ app }) as Iterable<SessionRecord>) {
				yield [toHex(record.hash), MessageStore.parseSessionRecord(record)]
			}
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
		getActionByHash: `SELECT * FROM actions WHERE hash = :hash`,
		getSessionByHash: `SELECT * FROM sessions WHERE hash = :hash`,
		getSessionByAddress: `SELECT * FROM sessions WHERE session_address = :session_address`,
		getSessions: `SELECT * FROM sessions`,
		getActions: `SELECT * FROM actions`,
		getSessionsByApp: `SELECT * FROM sessions WHERE app = :app`,
		getActionsByApp: `SELECT * FROM actions WHERE app = :app`,
	}
}
