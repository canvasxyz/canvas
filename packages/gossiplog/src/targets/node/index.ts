import path from "node:path"
import fs from "node:fs"

import { Environment, Transaction, Tree } from "@canvas-js/okra-node"
import { Bound, assert } from "@canvas-js/okra"

import openMemoryMessageLog from "../memory/index.js"

import {
	AbstractMessageLog,
	MessageLogInit,
	ReadOnlyTransaction,
	ReadWriteTransaction,
} from "../../AbstractMessageLog.js"

export * from "../../AbstractMessageLog.js"

export default async function openMessageLog<Payload, Result>(
	init: MessageLogInit<Payload, Result>
): Promise<AbstractMessageLog<Payload, Result>> {
	if (init.location === null) {
		return openMemoryMessageLog(init)
	}

	const directory = path.resolve(init.location, init.topic)
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true })
	}

	const env = new Environment(directory)
	return new MessageLog(init, env)
}

class MessageLog<Payload, Result> extends AbstractMessageLog<Payload, Result> {
	public constructor(init: MessageLogInit<Payload, Result>, private readonly env: Environment) {
		super(init)
	}

	public async close() {
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
