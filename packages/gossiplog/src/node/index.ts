import fs from "node:fs"

import { Bound, KeyValueStore } from "@canvas-js/okra"
import { Environment, Transaction, Tree } from "@canvas-js/okra-node"
import { assert } from "@canvas-js/utils"

import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"

export class GossipLog<Payload, Result> extends AbstractGossipLog<Payload, Result> {
	public static async open<Payload, Result>(
		init: GossipLogInit<Payload, Result>,
		path: string,
	): Promise<GossipLog<Payload, Result>> {
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, { recursive: true })
		}

		const env = new Environment(path, { databases: 3 })
		const gossipLog = new GossipLog(env, init)
		await gossipLog.write(async (txn) => {})

		return gossipLog
	}

	private static getReadOnlyAPI = (txn: Transaction, dbi: number): Omit<KeyValueStore, "set" | "delete"> => ({
		get: (key) => txn.get(key, { dbi }),
		entries: (lowerBound = null, upperBound = null, options = {}) =>
			txn.entries(lowerBound, upperBound, { ...options, dbi }),
	})

	private static getReadWriteAPI = (txn: Transaction, dbi: number): KeyValueStore => ({
		get: (key) => txn.get(key, { dbi }),
		set: (key, value) => txn.set(key, value, { dbi }),
		delete: (key) => txn.delete(key, { dbi }),
		entries: (lowerBound = null, upperBound = null, options = {}) =>
			txn.entries(lowerBound, upperBound, { ...options, dbi }),
	})

	private constructor(private readonly env: Environment, init: GossipLogInit<Payload, Result>) {
		super(init)
	}

	public async close() {
		this.log("closing")
		await this.env.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const txn = new Transaction(this.env, { readOnly: true })

		try {
			const tree = new Tree(txn, { dbi: "messages" })
			for await (const node of tree.nodes(0, lowerBound ?? { key: null, inclusive: false }, upperBound, options)) {
				assert(node.key !== null, "expected node.key !== null")
				assert(node.value !== undefined, "expected node.value !== undefined")
				yield [node.key, node.value]
			}
		} finally {
			txn.abort()
		}
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T> {
		this.log("opening read-only transaction")
		return await this.env.read(async (txn) => {
			const headsDBI = txn.openDatabase("heads")
			const messagesDBI = txn.openDatabase("messages")
			const messages = new Tree(txn, { dbi: messagesDBI })
			return await callback({
				ancestors: this.indexAncestors ? GossipLog.getReadOnlyAPI(txn, txn.openDatabase("ancestors")) : undefined,
				messages,
				heads: {
					get: (key) => txn.get(key, { dbi: headsDBI }),
					entries: (lowerBound = null, upperBound = null, options = {}) =>
						txn.entries(lowerBound, upperBound, { ...options, dbi: headsDBI }),
				},
			})
		})
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		this.log("opening read-write transaction")
		return await this.env.write(async (txn) => {
			const messages = new Tree(txn, { dbi: txn.openDatabase("messages") })
			return await callback({
				messages,
				heads: GossipLog.getReadWriteAPI(txn, txn.openDatabase("heads")),
				ancestors: this.indexAncestors ? GossipLog.getReadWriteAPI(txn, txn.openDatabase("ancestors")) : undefined,
			})
		})
	}
}
