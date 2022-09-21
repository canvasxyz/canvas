import path from "node:path"
import assert from "node:assert"

import Database, * as sqlite from "better-sqlite3"
import * as cbor from "microcbor"

import type { Action, Session, Block, ActionArgument } from "@canvas-js/interfaces"

import { mapEntries } from "../utils.js"
import { chainType } from "../codecs.js"

/**
 * The message log archives messages in its own separate SQLite database.
 */

type BlockRecord = {
	chain: string
	chain_id: number
	blocknum: number
	blockhash: Buffer
	timestamp: number
}

type ActionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer | null
	timestamp: number
	block_id: number | null
	call: string
	args: Buffer
}

type SessionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer
	duration: number
	timestamp: number
	block_id: number | null
}

export class MessageStore {
	static DATABASE_FILENAME = "messages.sqlite"

	private readonly database: sqlite.Database
	private readonly statements: Record<keyof typeof MessageStore.statements, sqlite.Statement>

	constructor(public readonly name: string, directory: string | null, options: { verbose?: boolean } = {}) {
		if (directory === null) {
			if (options.verbose) {
				console.log("[canvas-core] Initializing in-memory message store")
			}

			this.database = new Database(":memory:")
		} else {
			if (options.verbose) {
				console.log(`[canvas-core] Initializing message store at ${directory}`)
			}

			this.database = new Database(path.join(directory, MessageStore.DATABASE_FILENAME))
		}

		this.database.exec(MessageStore.createBlocksTable)
		this.database.exec(MessageStore.createSessionsTable)
		this.database.exec(MessageStore.createActionsTable)

		this.statements = mapEntries(MessageStore.statements, (_, sql) => this.database.prepare(sql))
	}

	public close() {
		this.database.close()
	}

	public insertAction(hash: string | Buffer, action: Action) {
		assert(action.payload.spec === this.name, "insertAction: action.payload.spec did not match MessageStore.name")

		const args = cbor.encode(action.payload.args)

		const record: ActionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: fromHex(action.signature),
			session_address: null,
			from_address: fromHex(action.payload.from),
			timestamp: action.payload.timestamp,
			call: action.payload.call,
			args: Buffer.from(args.buffer, args.byteOffset, args.byteLength),
			block_id: null,
		}

		if (action.payload.block !== undefined) {
			record.block_id = this.getBlockId(action.payload.block)
		}

		if (action.session !== null) {
			record.session_address = fromHex(action.session)
		}

		this.statements.insertAction.run(record)
	}

	public insertSession(hash: string | Buffer, session: Session) {
		assert(session.payload.spec === this.name, "insertSession: session.payload.spec did not match MessageStore.name")

		const record: SessionRecord = {
			hash: typeof hash === "string" ? fromHex(hash) : hash,
			signature: fromHex(session.signature),
			from_address: fromHex(session.payload.from),
			session_address: fromHex(session.payload.address),
			duration: session.payload.duration,
			timestamp: session.payload.timestamp,
			block_id: null,
		}

		if (session.payload.block !== undefined) {
			record.block_id = this.getBlockId(session.payload.block)
		}

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
				spec: this.name,
				from: toHex(record.from_address),
				call: record.call,
				args: cbor.decode(record.args) as ActionArgument[],
				timestamp: record.timestamp,
			},
		}

		if (record.block_id !== null) {
			action.payload.block = this.getBlock(record.block_id)
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
				spec: this.name,
				from: toHex(record.from_address),
				timestamp: record.timestamp,
				address: toHex(record.session_address),
				duration: record.duration,
			},
		}

		if (record.block_id !== null) {
			session.payload.block = this.getBlock(record.block_id)
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

	private getBlockId(block: Block): number {
		const record: undefined | { id: number; blockhash: Buffer; timestamp: number } = this.statements.getBlockId.get({
			chain: block.chain,
			chain_id: block.chainId,
			blocknum: block.blocknum,
		})

		if (record === undefined) {
			const { lastInsertRowid } = this.statements.insertBlock.run({
				chain: block.chain,
				chain_id: block.chainId,
				blockhash: fromHex(block.blockhash),
				blocknum: block.blocknum,
				timestamp: block.timestamp,
			})

			return Number(lastInsertRowid)
		} else {
			assert(block.blockhash === toHex(record.blockhash), "MessageStore.getBlockId: blockhashes did not match")
			assert(block.timestamp === record.timestamp, "MessageStore.getBlockId: timestamps did not match")
			return record.id
		}
	}

	private getBlock(blockId: number): Block {
		const record: undefined | BlockRecord = this.statements.getBlock.get({ id: blockId })
		if (record === undefined) {
			throw new Error("internal error: failed to look up block id")
		}

		assert(chainType.is(record.chain), `invalid chain type ${JSON.stringify(record.chain)}`)

		return {
			chain: record.chain,
			chainId: record.chain_id,
			blocknum: record.blocknum,
			blockhash: toHex(record.blockhash),
			timestamp: record.timestamp,
		}
	}

	private static createBlocksTable = `CREATE TABLE IF NOT EXISTS blocks (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    chain     TEXT    NOT NULL,
    chain_id  INTEGER NOT NULL,
    blocknum  INTEGER NOT NULL,
    blockhash BLOB    NOT NULL,
    timestamp INTEGER NOT NULL,
    UNIQUE(chain, chain_id, blocknum)
  );`

	private static createActionsTable = `CREATE TABLE IF NOT EXISTS actions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            BLOB    NOT NULL,
    signature       BLOB    NOT NULL,
    session_address BLOB    REFERENCES sessions(session_address),
    from_address    BLOB    NOT NULL,
    timestamp       INTEGER NOT NULL,
    block_id        INTEGER REFERENCES blocks(id),
    call            TEXT    NOT NULL,
    args            BLOB    NOT NULL
  );`

	private static createSessionsTable = `CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            BLOB    NOT NULL UNIQUE,
    signature       BLOB    NOT NULL UNIQUE,
    from_address    BLOB    NOT NULL,
    session_address BLOB    NOT NULL UNIQUE,
    duration        INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
    block_id        INTEGER REFERENCES blocks(id)
  );`

	private static statements = {
		insertBlock: `INSERT INTO BLOCKS (
      chain, chain_id, blocknum, blockhash, timestamp
    ) VALUES (
      :chain, :chain_id, :blocknum, :blockhash, :timestamp
    )`,
		insertAction: `INSERT INTO actions (
      hash, signature, session_address, from_address, timestamp, block_id, call, args
    ) VALUES (
      :hash, :signature, :session_address, :from_address, :timestamp, :block_id, :call, :args
    )`,
		insertSession: `INSERT INTO sessions (
      hash, signature, from_address, session_address, duration, timestamp, block_id
    ) VALUES (
      :hash, :signature, :from_address, :session_address, :duration, :timestamp, :block_id
    )`,
		getBlock: `SELECT * FROM blocks WHERE id = :id`,
		getBlockId: `SELECT id, blockhash, timestamp FROM blocks WHERE chain = :chain AND chain_id = :chain_id AND blocknum = :blocknum`,
		getActionByHash: `SELECT * FROM actions WHERE hash = :hash`,
		getSessionByHash: `SELECT * FROM sessions WHERE hash = :hash`,
		getSessionByAddress: `SELECT * FROM sessions WHERE session_address = :session_address`,
		getSessions: `SELECT * FROM sessions`,
		getActions: `SELECT * FROM actions`,
	}
}

function fromHex(input: string) {
	assert(input.startsWith("0x"), 'input did not start with "0x"')
	return Buffer.from(input.slice(2), "hex")
}

function toHex(data: Buffer) {
	return `0x${data.toString("hex")}`
}
