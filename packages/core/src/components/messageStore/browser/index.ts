import * as okra from "@canvas-js/okra-browser"

import type { Action, Session, ActionArgument, Chain, ChainId, CustomAction, Message } from "@canvas-js/interfaces"

import { mapEntries, toHex, stringify, signalInvalidType, assert } from "@canvas-js/core/utils"
import { MESSAGE_DATABASE_FILENAME, MST_DIRECTORY_NAME } from "@canvas-js/core/constants"

import { getMessageKey } from "@canvas-js/core/sync"

import type { MessageStore, ReadOnlyTransaction, ReadWriteTransaction, Node } from "../types.js"
export * from "../types.js"

type MessageObject = { id: Uint8Array } & Message

class IndexedDBMessageStore {
	public static async initialize(
		app: string,
		directory: string | null,
		sources: Set<string> = new Set([]),
		options: { verbose?: boolean } = {}
	): Promise<IndexedDBMessageStore> {
		assert(directory !== null)
		const tree = await okra.Tree.open<MessageObject>(directory, {
			dbs: [app, ...sources],
			getID: ({ id }) => id,
			initializeStore: (dbi, store) =>
				store.createIndex("sessionAddress", ["payload", "sessionAddress"], { multiEntry: false, unique: true }),
		})

		return new IndexedDBMessageStore(app, sources, tree)
	}

	private constructor(
		private readonly app: string,
		private readonly sources: Set<string>,
		private readonly tree: okra.Tree<MessageObject>
	) {
		throw new Error("not implemented")
	}

	public async close() {
		this.tree.close()
	}

	public getMerkleRoots(): Record<string, string> {
		throw new Error("not implemented")
	}

	public async *getMessageStream(
		filter: { type?: Message["type"]; limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const storeNames = filter.app ?? [this.app, ...this.sources]
		const txn = this.tree.db.transaction(storeNames, "readonly", {})

		for (const storeName of txn.objectStoreNames) {
			const store = txn.objectStore(storeName)
			let cursor = await store.openCursor(null)
			while (cursor !== null) {
				const { id, ...message } = cursor.value as MessageObject
				yield [id, message]
				cursor = await cursor.continue()
			}
		}
	}

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { dbi?: string } = {}
	): Promise<T> {
		const dbi = options.dbi ?? this.app
		assert(dbi === this.app || this.sources.has(dbi))
		return this.tree.read((txn) => callback(this.getReadOnlyTransaction(txn)), { dbi })
	}

	private getReadOnlyTransaction = (
		txn: okra.ReadOnlyTransaction<MessageObject> | okra.ReadWriteTransaction<MessageObject>
	): ReadOnlyTransaction => ({
		getSessionByAddress: async (chain, chainId, address) => {
			const result: MessageObject | undefined = await txn.db.getFromIndex(txn.dbi, "sessionAddress", address)
			if (result && result.type === "session") {
				const { id, ...session } = result
				return [toHex(id), session]
			} else {
				return [null, null]
			}
		},
		getMessage: async (id) => {
			const object = await txn.get(id)
			if (object === null) {
				return null
			} else {
				const { id: _, ...message } = object
				return message
			}
		},
		getNode: (level, key) => txn.getNode(level, key).then(parseNode),
		getRoot: () => txn.getRoot().then(parseNode),
		getChildren: (level, key) => txn.getChildren(level, key).then((children) => children.map(parseNode)),
		seek: async (level, key) => {
			const node = await txn.seek(level, key)
			return node && parseNode(node)
		},
	})

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => T | Promise<T>,
		options: { dbi?: string } = {}
	): Promise<T> {
		const dbi = options.dbi ?? this.app
		assert(dbi === this.app || this.sources.has(dbi))
		return await this.tree.write(
			async (txn) => {
				const result = await callback(this.getReadWriteTransaction(txn))
				// const root = await txn.getRoot()
				// this.merkleRoots[dbi] = toHex(root.hash)
				return result
			},
			{ dbi }
		)
	}

	private getReadWriteTransaction = (txn: okra.ReadWriteTransaction<MessageObject>): ReadWriteTransaction => ({
		...this.getReadOnlyTransaction(txn),
		insertMessage: (id, message) => txn.set(getMessageKey(id, message), { id, ...message }),
	})
}

const parseNode = ({ level, key, hash, value }: okra.Node<MessageObject>): Node =>
	value ? { level, key, hash, id: value.id } : { level, key, hash }

export const openMessageStore = (
	app: string,
	directory: string | null,
	sources: Set<string> = new Set([]),
	options: { verbose?: boolean } = {}
): Promise<MessageStore> => IndexedDBMessageStore.initialize(app, directory, sources, options)
