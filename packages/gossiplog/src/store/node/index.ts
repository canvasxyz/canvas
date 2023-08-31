import path from "node:path"

import { Tree } from "@canvas-js/okra-node"

import openMemoryMessageLog from "../memory/index.js"

import { AbstractMessageLog, MessageLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractStore.js"

export * from "../AbstractStore.js"

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

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T> {
		return await this.tree.read((txn) => callback(txn))
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		return await this.tree.write((txn) => callback(txn))
	}
}
