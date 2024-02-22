import PQueue from "p-queue"
import pDefer from "p-defer"

import { Bound, KeyValueStore } from "@canvas-js/okra"
import { PostgresTree } from "@canvas-js/okra-pg"
import pg from "pg"

import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { assert } from "../utils.js"

export class GossipLog<Payload, Result> extends AbstractGossipLog<Payload, Result> {
	private pool: pg.Pool
	private messagesClient: pg.PoolClient
	private headsClient: pg.PoolClient
	private ancestorsClient: pg.PoolClient
	private readonly queue = new PQueue({ concurrency: 1 })

	private messages: PostgresTree
	private heads: PostgresTree
	private ancestors: PostgresTree

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

		const messages = await PostgresTree.initialize(messagesClient, { prefix: "messages", clear: true })
		const heads = await PostgresTree.initialize(headsClient, { prefix: "heads", clear: true })
		const ancestors = await PostgresTree.initialize(ancestorsClient, { prefix: "ancestors", clear: true })

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
			heads: PostgresTree
			ancestors: PostgresTree
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
			})
			// console.log("end write tx")
			return result
		})
		return result as T
	}
}
