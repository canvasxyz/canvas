import PQueue from "p-queue"
import pDefer from "p-defer"
import * as cbor from "@ipld/dag-cbor"

import pg from "pg"
import { hexToBytes } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import { Bound } from "@canvas-js/okra"
import { PostgresTree, PostgresStore } from "@canvas-js/okra-pg"
import { assert } from "@canvas-js/utils"

import { KEY_LENGTH, decodeId, encodeId, encodeSignedMessage } from "../schema.js"
import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { cborNull, getAncestorClocks } from "../utils.js"

import { getAncestorsSql } from "./get_ancestors.sql.js"
import { isAncestorSql } from "./is_ancestor.sql.js"
import { decodeClockSql } from "./decode_clock.sql.js"
import { pgCborSql } from "./pg_cbor.sql.js"
import { insertSql } from "./insert_updating_ancestors.sql.js"
import { insertMessageRemovingHeadsSql } from "./insert_message_removing_heads.sql.js"
import { decodeClock } from "../clock.js"
import { Message, Signature } from "@canvas-js/interfaces"

const initSql = [
	getAncestorsSql,
	isAncestorSql,
	decodeClockSql,
	pgCborSql,
	insertSql,
	insertMessageRemovingHeadsSql,
].join("\n")

async function getAncestors<Payload, Result>(
	log: GossipLog<Payload, Result>,
	key: Uint8Array,
	atOrBefore: number,
): Promise<Uint8Array[]> {
	const result = await log.ancestorsClient.query<{ ret_results: Uint8Array[] }>(
		`SELECT ret_results FROM get_ancestors($1, $2, '{}'::bytea[]);`,
		[key, atOrBefore],
	)
	const { rows } = result
	const row = rows[0]
	return row.ret_results
}

async function isAncestor<Payload, Result>(
	log: GossipLog<Payload, Result>,
	key: Uint8Array,
	ancestorKey: Uint8Array,
): Promise<boolean> {
	const { rows } = await log.ancestorsClient.query(`SELECT ret_result FROM is_ancestor($1, $2, '{}'::bytea[]);`, [
		key,
		ancestorKey,
	])
	const row = rows[0] as { ret_result: boolean }
	return row.ret_result
}

async function insertUpdatingAncestors<Payload, Result>(
	client: pg.PoolClient,
	ancestors: PostgresStore,
	key: Uint8Array,
	parentKeys: Uint8Array[],
) {
	const [clock] = decodeClock(key)
	const ancestorClocks = Array.from(getAncestorClocks(clock))

	const { rows } = await client.query<{ insert_updating_ancestors: string[][] }>(
		`SELECT insert_updating_ancestors($1, $2::bytea[], $3::integer[]);`,
		[key, parentKeys.map(Buffer.from), ancestorClocks],
	)

	assert(rows.length > 0)
	const [{ insert_updating_ancestors: result }] = rows
	const ancestorLinks = result.map((arr) => arr.map((id) => hexToBytes(id.replace("\\x", ""))))

	await ancestors.set(key, cbor.encode(ancestorLinks))
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
	await log.ancestorsClient.query<{}>(`CALL insert_message_removing_heads($1, $2, $3, $4, $5::bytea[]);`, args)
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
		connectionConfig: string | pg.PoolConfig,
		clear: boolean = false,
	): Promise<GossipLog<Payload, Result>> {
		const pool =
			typeof connectionConfig === "string"
				? new pg.Pool({ connectionString: connectionConfig })
				: new pg.Pool(connectionConfig)

		const messagesClient = await pool.connect()
		const headsClient = await pool.connect()
		const ancestorsClient = await pool.connect()

		pool.on("error", (err, client) => {
			console.error("Unexpected error on idle client", err)
		})

		const messages = await PostgresTree.initialize(messagesClient, { prefix: this.MESSAGES_TABLE_PREFIX, clear })
		const heads = await PostgresStore.initialize(headsClient, { table: this.HEADS_TABLE, clear })
		const ancestors = await PostgresStore.initialize(ancestorsClient, { table: this.ANCESTORS_TABLE, clear })

		await ancestorsClient.query(initSql)

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
				getHeads: async (): Promise<Uint8Array[]> => getHeads(this.headsClient),
				getAncestors: (key: Uint8Array, atOrBefore: number, results: Set<string>): Promise<void> =>
					getAncestors(this, key, atOrBefore).then((keys) => keys.forEach((key) => results.add(decodeId(key)))),
				isAncestor: (key: Uint8Array, ancestorKey: Uint8Array): Promise<boolean> => isAncestor(this, key, ancestorKey),

				messages: this.messages,
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
				getHeads: async (): Promise<Uint8Array[]> => getHeads(this.headsClient),
				getAncestors: (key: Uint8Array, atOrBefore: number, results: Set<string>): Promise<void> =>
					getAncestors(this, key, atOrBefore).then((keys) => keys.forEach((key) => results.add(decodeId(key)))),
				isAncestor: (key: Uint8Array, ancestorKey: Uint8Array): Promise<boolean> => isAncestor(this, key, ancestorKey),

				insert: async (
					id: string,
					signature: Signature,
					message: Message,
					[key, value] = encodeSignedMessage(signature, message),
				) => {
					const parentKeys = message.parents.map(encodeId)
					const hash = this.messages.hashEntry(key, value)
					await insertMessageRemovingHeads(this, key, value, hash, cborNull, parentKeys)

					if (this.indexAncestors) {
						await insertUpdatingAncestors(this.ancestorsClient, this.ancestors, key, parentKeys)
					}
				},

				messages: this.messages,
			})
			// console.log("end write tx")
			return result
		})
		return result as T
	}
}

async function getHeads<Payload, Result>(heads: pg.PoolClient): Promise<Uint8Array[]> {
	const { rows } = await heads.query(`SELECT * FROM heads ORDER BY key`)
	return rows.map(({ key, value }: { key: Uint8Array; value: Uint8Array }) => {
		assert(key.byteLength === KEY_LENGTH, "internal error (expected key.byteLength === KEY_LENGTH)")
		assert(equals(value, cborNull), "internal error (unexpected parent entry value)")
		return key
	})
}
