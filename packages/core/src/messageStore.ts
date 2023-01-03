import assert from "node:assert"
import Database, * as sqlite from "better-sqlite3"
import * as cbor from "microcbor"
import { CID } from "multiformats"

import type { Action, Session, ActionArgument, Chain, ChainId } from "@canvas-js/interfaces"

import { mapEntries, fromHex, toHex, toBuffer, signalInvalidType, parseIPFSURI } from "./utils.js"
import { BinaryAction, BinaryMessage, BinarySession, fromBinaryAction, fromBinarySession } from "./encoding.js"
import { encodeAddress } from "./chains/index.js"

type ActionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer | null
	timestamp: number
	call: string
	args: Buffer
	chain: Chain
	chain_id: ChainId
	blockhash: Buffer | null
	source: Buffer | null
}

type SessionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer
	duration: number
	timestamp: number
	chain: Chain
	chain_id: ChainId
	blockhash: Buffer | null
	source: Buffer | null
}

/**
 * The message log archives messages in its own separate SQLite database.
 */
export class MessageStore {
	public readonly database: sqlite.Database
	private readonly statements: Record<keyof typeof MessageStore.statements, sqlite.Statement>
	private readonly sourceCIDs: Record<string, CID>

	constructor(
		private readonly uri: string,
		path: string | null,
		sources: Set<string> = new Set([]),
		options: { verbose?: boolean } = {}
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
		this.sourceCIDs = {}
		for (const uri of sources) {
			const cid = parseIPFSURI(uri)
			assert(cid !== null, "sources must be ipfs:// URIs")
			this.sourceCIDs[uri] = cid
		}
	}

	public close() {
		this.database.close()
	}

	public insert(hash: string | Buffer, binaryMessage: BinaryMessage) {
		if (binaryMessage.type === "action") {
			this.insertAction(hash, binaryMessage)
		} else if (binaryMessage.type === "session") {
			this.insertSession(hash, binaryMessage)
		} else {
			signalInvalidType(binaryMessage)
		}
	}

	public insertAction(hash: string | Buffer, action: BinaryAction) {
		const sourceCID: CID | undefined = this.sourceCIDs[action.payload.spec]
		assert(
			action.payload.spec === this.uri || sourceCID !== undefined,
			"insertAction: action.payload.spec not found in MessageStore.sources"
		)

		const record: ActionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: toBuffer(action.signature),
			session_address: action.session ? toBuffer(action.session) : null,
			from_address: toBuffer(action.payload.from),
			timestamp: action.payload.timestamp,
			call: action.payload.call,
			args: toBuffer(cbor.encode(action.payload.args)),
			chain: action.payload.chain,
			chain_id: action.payload.chainId,
			blockhash: action.payload.blockhash ? toBuffer(action.payload.blockhash) : null,
			source: sourceCID ? toBuffer(sourceCID.bytes) : null,
		}

		this.statements.insertAction.run(record)
	}

	public insertSession(hash: string | Buffer, session: BinarySession) {
		const sourceCID: CID | undefined = this.sourceCIDs[session.payload.spec]
		assert(
			session.payload.spec === this.uri || sourceCID !== undefined,
			"insertSession: session.payload.spec not found in MessageStore.sources"
		)

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
			source: sourceCID ? toBuffer(sourceCID.bytes) : null,
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
    call            TEXT    NOT NULL,
    args            BLOB    NOT NULL,
		chain           TEXT    NOT NULL,
    chain_id        INTEGER NOT NULL,
    blockhash       BLOB,
		source          BLOB
  );`

	private static createSessionsTable = `CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            BLOB    NOT NULL UNIQUE,
    signature       BLOB    NOT NULL,
    from_address    BLOB    NOT NULL,
    session_address BLOB    NOT NULL UNIQUE,
    duration        INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
		chain           TEXT    NOT NULL,
    chain_id        INTEGER NOT NULL,
    blockhash       BLOB,
		source          BLOB
  );`

	private static statements = {
		insertAction: `INSERT INTO actions (
      hash, signature, session_address, from_address, timestamp, call, args, chain, chain_id, blockhash, source
    ) VALUES (
      :hash, :signature, :session_address, :from_address, :timestamp, :call, :args, :chain, :chain_id, :blockhash, :source
    )`,
		insertSession: `INSERT INTO sessions (
      hash, signature, from_address, session_address, duration, timestamp, chain, chain_id, blockhash, source
    ) VALUES (
      :hash, :signature, :from_address, :session_address, :duration, :timestamp, :chain, :chain_id, :blockhash, :source
    )`,
		getActionByHash: `SELECT * FROM actions WHERE hash = :hash`,
		getSessionByHash: `SELECT * FROM sessions WHERE hash = :hash`,
		getSessionByAddress: `SELECT * FROM sessions WHERE session_address = :session_address`,
		getSessions: `SELECT * FROM sessions`,
		getActions: `SELECT * FROM actions`,
	}
}

const ipfsURIPattern = /^ipfs\/\/:([a-zA-Z0-9]+)$/
function parseCID(uri: string): CID | null {
	const match = ipfsURIPattern.exec(uri)
	if (match) {
		const [_, cid] = match
		return CID.parse(cid)
	} else {
		return null
	}
}
