import fs from "node:fs"

import { Environment, Transaction, Tree } from "@canvas-js/okra-node"
import { Bound } from "@canvas-js/okra"

import { AbstractMessageLog, MessageLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractMessageLog.js"
import { assert } from "../utils.js"

export class MessageLog<Payload, Result> extends AbstractMessageLog<Payload, Result> {
	public static async open<Payload, Result>(
		path: string,
		init: MessageLogInit<Payload, Result>
	): Promise<MessageLog<Payload, Result>> {
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, { recursive: true })
		}

		const env = new Environment(path)
		return new MessageLog(init, env)
	}

	private constructor(init: MessageLogInit<Payload, Result>, private readonly env: Environment) {
		super(init)
	}

	public async close() {
		this.log("closing")
		await this.env.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const txn = new Transaction(this.env, { readOnly: true, dbi: "messages" })
		try {
			for await (const node of txn.nodes(0, lowerBound ?? { key: null, inclusive: false }, upperBound, options)) {
				assert(node.key !== null, "expected node.key !== null")
				assert(node.value !== undefined, "expected node.value !== undefined")
				yield [node.key, node.value]
			}
		} finally {
			txn.abort()
		}
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T> {
		return await this.env.read(async (txn) => {
			const parentsDBI = txn.openDatabase("parents")
			const messagesDBI = txn.openDatabase("messages")
			const messages = new Tree(txn, { dbi: messagesDBI })
			return await callback({
				messages,
				parents: {
					get: (key) => txn.get(key, { dbi: parentsDBI }),
					entries: (lowerBound = null, upperBound = null, options = {}) =>
						txn.entries(lowerBound, upperBound, { ...options, dbi: parentsDBI }),
				},
			})
		})
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		return await this.env.read(async (txn) => {
			const parentsDBI = txn.openDatabase("parents")
			const messagesDBI = txn.openDatabase("messages")
			const messages = new Tree(txn, { dbi: messagesDBI })
			return await callback({
				messages,
				parents: {
					get: (key) => txn.get(key, { dbi: parentsDBI }),
					set: (key, value) => txn.set(key, value, { dbi: parentsDBI }),
					delete: (key) => txn.delete(key, { dbi: parentsDBI }),
					entries: (lowerBound = null, upperBound = null, options = {}) =>
						txn.entries(lowerBound, upperBound, { ...options, dbi: parentsDBI }),
				},
			})
		})
	}
}
