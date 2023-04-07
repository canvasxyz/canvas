import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import * as okra from "@canvas-js/okra-browser"

import type { Message } from "@canvas-js/interfaces"
import { toHex, assert } from "@canvas-js/core/utils"
import { getMessageKey } from "@canvas-js/core/sync"

import { openDB, IDBPDatabase } from "idb"

import type { MessageStore, ReadOnlyTransaction, ReadWriteTransaction, Node, MessageStoreEvents } from "../types.js"

export * from "../types.js"

class IndexedDBMessageStore extends EventEmitter<MessageStoreEvents> implements MessageStore {
	public static version = 1
	public static async initialize(
		app: string,
		directory: string | null,
		sources: Set<string> = new Set([]),
		options: { verbose?: boolean } = {}
	): Promise<IndexedDBMessageStore> {
		assert(directory !== null)

		const db = await openDB(directory, IndexedDBMessageStore.version, {
			upgrade(database, oldVersion, newVersion, transaction, event) {
				for (const dbi of [app, ...sources]) {
					database.createObjectStore(dbi)
					database.createObjectStore(`${dbi}/sessions`)
				}
			},
		})

		const mst = await okra.Tree.open(`${directory}/mst`, { dbs: [app, ...sources] })

		const store = new IndexedDBMessageStore(app, sources, db, mst, options)

		for (const dbi of [app, ...sources]) {
			const { hash } = await mst.read((txn) => txn.getRoot(), { dbi })
			store.merkleRoots[dbi] = toHex(hash)
		}

		return store
	}

	private merkleRoots: Record<string, string> = {}

	private constructor(
		private readonly app: string,
		private readonly sources: Set<string>,
		private readonly db: IDBPDatabase,
		private readonly mst: okra.Tree,
		private readonly options: { verbose?: boolean }
	) {
		super()
	}

	public async close() {
		this.db.close()
		this.mst.close()
	}

	public async *getMessageStream(
		filter: { type?: Message["type"]; limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const storeNames = filter.app ? [filter.app] : [this.app, ...this.sources]
		const txn = this.db.transaction(storeNames, "readonly", {})
		for (const storeName of txn.objectStoreNames) {
			const store = txn.objectStore(storeName)
			let cursor = await store.openCursor(null)
			while (cursor !== null) {
				const id = cursor.key instanceof ArrayBuffer ? new Uint8Array(cursor.key) : (cursor.key as Uint8Array)
				const message = cursor.value as Message
				yield [id, message]
				cursor = await cursor.continue()
			}
		}
	}

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))
		return this.mst.read((txn) => callback(this.getReadOnlyTransaction(uri, txn)), { dbi: uri })
	}

	private getReadOnlyTransaction = (
		uri: string,
		txn: okra.ReadOnlyTransaction<Uint8Array> | okra.ReadWriteTransaction
	): ReadOnlyTransaction => ({
		uri,
		getSessionByAddress: async (chain, address) => {
			const id: Uint8Array | undefined = await this.db.get(`${txn.dbi}/sessions`, address)
			if (id === undefined) {
				return [null, null]
			}

			const message: Message | undefined = await this.db.get(txn.dbi, id)
			if (message === undefined || message.type !== "session") {
				throw new Error("internal error: inconsistent session address index")
			}

			return [toHex(id), message]
		},
		getMessage: async (id) => {
			const message: Message | undefined = await this.db.get(txn.dbi, id)
			return message ?? null
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
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))
		let result: T | undefined = undefined
		const root = await this.mst.write(
			async (txn) => {
				result = await callback(this.getReadWriteTransaction(uri, txn))
				return await txn.getRoot()
			},
			{ dbi: uri }
		)

		this.merkleRoots[uri] = toHex(root.hash)
		this.dispatchEvent(new CustomEvent("update", { detail: { uri: uri, root: null } }))
		return result!
	}

	private getReadWriteTransaction = (
		uri: string,
		txn: okra.ReadWriteTransaction<Uint8Array>
	): ReadWriteTransaction => ({
		...this.getReadOnlyTransaction(uri, txn),
		insertMessage: async (id, message) => {
			const key = getMessageKey(id, message)
			await txn.set(key, id)
			await this.db.put(txn.dbi, message, id)
			if (message.type === "session") {
				await this.db.put(`${txn.dbi}/sessions`, id, message.payload.sessionAddress)
			}
		},
	})

	public getMerkleRoots(): Record<string, string> {
		return this.merkleRoots
	}
}

const parseNode = ({ level, key, hash, value }: okra.Node): Node =>
	value ? { level, key, hash, id: value } : { level, key, hash }

export const openMessageStore = (
	app: string,
	directory: string | null,
	sources: Set<string> = new Set([]),
	options: { verbose?: boolean } = {}
): Promise<MessageStore> => IndexedDBMessageStore.initialize(app, directory, sources, options)
