import path from "node:path"

import { ReadOnlyTransaction, ReadWriteTransaction, Tree } from "@canvas-js/okra-node"
import { Bound, assert } from "@canvas-js/okra"

import openMemoryMessageLog from "../memory/index.js"

import { AbstractMessageLog, MessageLogInit } from "../AbstractMessageLog.js"

export * from "../AbstractMessageLog.js"

export default async function openMessageLog<Payload, Result>(
	init: MessageLogInit<Payload, Result>
): Promise<AbstractMessageLog<Payload, Result>> {
	if (init.location === null) {
		return openMemoryMessageLog(init)
	}

	const tree = new Tree(path.resolve(init.location, init.topic))
	return new MessageLog(init, tree)
}

class MessageLog<Payload, Result> extends AbstractMessageLog<Payload, Result> {
	public constructor(init: MessageLogInit<Payload, Result>, private readonly tree: Tree) {
		super(init)
	}

	public async close() {
		await this.tree.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const txn = new ReadOnlyTransaction(this.tree)
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
		return await this.tree.read((txn) => callback(txn))
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		return await this.tree.write((txn) => callback(txn))
	}
}
