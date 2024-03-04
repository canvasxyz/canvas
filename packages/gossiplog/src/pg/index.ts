import PQueue from "p-queue"
import pDefer from "p-defer"

import { Bound, KeyValueStore } from "@canvas-js/okra"
import { PostgresTree, PostgresStore } from "@canvas-js/okra-pg"
import { Awaitable } from "@canvas-js/interfaces"

import pg from "pg"
import { hexToBytes, bytesToHex as hex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { assert, cborNull } from "../utils.js"
import { encodeId, decodeId, KEY_LENGTH } from "../schema.js"

import { getAncestorsSql } from "./get_ancestors.sql.js"
import { isAncestorSql } from "./is_ancestor.sql.js"
import { decodeClockSql } from "./decode_clock.sql.js"
import { pgCborSql } from "./pg_cbor.sql.js"
import { insertSql } from "./insert_updating_ancestors.sql.js"
import { insertMessageRemovingHeadsSql } from "./insert_message_removing_heads.sql.js"

async function getAncestors<Payload, Result>(
	log: GossipLog<Payload, Result>,
	key: Uint8Array,
	atOrBefore: number,
): Promise<Uint8Array[]> {
	const { rows } = await log.ancestorsClient.query(`SELECT get_ancestors($1, $2);`, [key, atOrBefore])
	const row = rows[0] as { get_ancestors: Uint8Array[] }
	return row.get_ancestors
}

async function isAncestor<Payload, Result>(
	log: GossipLog<Payload, Result>,
	key: Uint8Array,
	ancestorKey: Uint8Array,
): Promise<boolean> {
	const { rows } = await log.ancestorsClient.query(`SELECT is_ancestor($1, $2);`, [key, ancestorKey])
	const row = rows[0] as { is_ancestor: boolean }
	return row.is_ancestor
}

async function insertUpdatingAncestors<Payload, Result>(
	log: GossipLog<Payload, Result>,
	key: Uint8Array,
	value: Uint8Array,
	parents: Uint8Array[],
	ancestorClocks: number[],
): Promise<Uint8Array[][]> {
	const { rows } = await log.ancestorsClient.query(
		`SELECT insert_updating_ancestors($1, $2, $3::bytea[], $4::integer[]);`,
		[key, value, parents.map(Buffer.from), ancestorClocks],
	)
	const row = rows[0] as { insert_updating_ancestors: string[][] }
	const ancestors = row.insert_updating_ancestors.map((arr) => arr.map((id) => hexToBytes(id.replace("\\x", ""))))
	return ancestors
}

async function insertMessageRemovingHeads<Payload, Result>(
	log: GossipLog<Payload, Result>,
	key: Uint8Array,
	value: Uint8Array,
	hash: Uint8Array,
	cborNull: Uint8Array,
	heads: Uint8Array[],
): Promise<void> {
	const args = [key, value, hash, cborNull, heads.map(Buffer.from)]
	await log.ancestorsClient.query(`CALL insert_message_removing_heads($1, $2, $3, $4, $5::bytea[]);`, args)
}

async function getHeads<Payload, Result>(log: GossipLog<Payload, Result>): Promise<Uint8Array[]> {
	const { rows } = await log.headsClient.query(`SELECT * FROM heads ORDER BY key`)
	return rows.map(({ key, value }: { key: Uint8Array; value: Uint8Array }) => {
		assert(key.byteLength === KEY_LENGTH, "internal error (expected key.byteLength === KEY_LENGTH)")
		assert(equals(value, cborNull), "internal error (unexpected parent entry value)")
		return key
	})
}

export class GossipLog<Payload, Result> extends AbstractGossipLog<Payload, Result> {
	private pool: pg.Pool
	public messagesClient: pg.PoolClient
	public headsClient: pg.PoolClient
	public ancestorsClient: pg.PoolClient
	private readonly queue = new PQueue({ concurrency: 1 })

	private messages: PostgresTree
	private heads: PostgresStore
	private ancestors: PostgresStore

	private static MESSAGES_TABLE_PREFIX = "messages"
	private static HEADS_TABLE = "heads"
	private static ANCESTORS_TABLE = "ancestors"

	public static async open<Payload, Result>(
		init: GossipLogInit<Payload, Result>,
		connectionString: string,
	): Promise<GossipLog<Payload, Result>> {
		const pool = new pg.Pool({ connectionString })

		const messagesClient = await pool.connect()
		const headsClient = await pool.connect()
		const ancestorsClient = await pool.connect()

		pool.on("error", (err, client) => {
			console.error("Unexpected error on idle client", err)
		})

		const messages = await PostgresTree.initialize(messagesClient, { prefix: this.MESSAGES_TABLE_PREFIX, clear: true })
		const heads = await PostgresStore.initialize(headsClient, { table: this.HEADS_TABLE, clear: true })
		const ancestors = await PostgresStore.initialize(ancestorsClient, { table: this.ANCESTORS_TABLE, clear: true })

		await ancestorsClient.query(getAncestorsSql)
		await ancestorsClient.query(isAncestorSql)
		await ancestorsClient.query(decodeClockSql)
		await ancestorsClient.query(pgCborSql)
		await ancestorsClient.query(insertSql)
		await ancestorsClient.query(insertMessageRemovingHeadsSql)

		const gossipLog = new GossipLog(
			{
				pool,
				messagesClient,
				headsClient,
				ancestorsClient,
				messages,
				heads,
				ancestors,
			},
			init,
		)

		await gossipLog.write(async (txn) => {})

		return gossipLog
	}

	private constructor(
		{
			pool,
			messagesClient,
			headsClient,
			ancestorsClient,
			messages,
			heads,
			ancestors,
		}: {
			pool: pg.Pool
			messagesClient: pg.PoolClient
			headsClient: pg.PoolClient
			ancestorsClient: pg.PoolClient
			messages: PostgresTree
			heads: PostgresStore
			ancestors: PostgresStore
		},
		init: GossipLogInit<Payload, Result>,
	) {
		super(init)
		this.pool = pool
		this.messagesClient = messagesClient
		this.headsClient = headsClient
		this.ancestorsClient = ancestorsClient
		this.messages = messages
		this.heads = heads
		this.ancestors = ancestors
	}

	public async close() {
		this.log("closing")

		this.queue.clear()
		await this.queue.onIdle()

		this.messagesClient.release()
		this.headsClient.release()
		this.ancestorsClient.release()
		await this.pool.end()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const deferred = pDefer()

		this.queue.add(() => {
			return deferred.promise
		})

		try {
			for await (const node of this.messages.nodes(0, lowerBound ?? null, upperBound, options)) {
				assert(node.key !== null, "expected node.key !== null")
				assert(node.value !== undefined, "expected node.value !== undefined")
				yield [node.key, node.value]
			}
		} finally {
			deferred.resolve()
		}
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T> {
		this.log("opening read-only transaction")

		const result = await this.queue.add(async () => {
			// console.log("start read tx")
			const result = await callback({
				messages: this.messages,
				heads: this.heads,
				ancestors: this.indexAncestors ? this.ancestors : undefined,
				getAncestors: (key: Uint8Array, atOrBefore: number): Promise<Uint8Array[]> =>
					getAncestors(this, key, atOrBefore),
				isAncestor: (key: Uint8Array, ancestorKey: Uint8Array): Promise<boolean> => isAncestor(this, key, ancestorKey),
			})
			// console.log("end read tx")
			return result
		})
		return result as T
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		this.log("opening read-write transaction")

		const result = await this.queue.add(async () => {
			// console.log("start write tx")
			const result = await callback({
				messages: this.messages,
				heads: this.heads,
				ancestors: this.indexAncestors ? this.ancestors : undefined,
				getAncestors: (key: Uint8Array, atOrBefore: number): Promise<Uint8Array[]> =>
					getAncestors(this, key, atOrBefore),
				isAncestor: (key: Uint8Array, ancestorKey: Uint8Array): Promise<boolean> => isAncestor(this, key, ancestorKey),
				insertUpdatingAncestors: (
					key: Uint8Array,
					value: Uint8Array,
					parents: Uint8Array[],
					ancestorClocks: number[],
				): Promise<Uint8Array[][]> => insertUpdatingAncestors(this, key, value, parents, ancestorClocks),
				insertMessageRemovingHeads: (
					key: Uint8Array,
					value: Uint8Array,
					cborNull: Uint8Array,
					parents: Uint8Array[],
				): Promise<void> => {
					const hash = this.messages.hashEntry(key, value)
					return insertMessageRemovingHeads(this, key, value, hash, cborNull, parents)
				},
				getHeads: async (): Promise<Uint8Array[]> => getHeads(this),
			})
			// console.log("end write tx")
			return result
		})
		return result as T
	}
}
