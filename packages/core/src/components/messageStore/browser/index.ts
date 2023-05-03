import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import * as okra from "@canvas-js/okra-browser"

import type { Message } from "@canvas-js/interfaces"
import { toHex, assert } from "@canvas-js/core/utils"
import { getMessageKey } from "@canvas-js/core/sync"

import { openDB, IDBPDatabase } from "idb"

import type { MessageStore, ReadOnlyTransaction, ReadWriteTransaction, Node, MessageStoreEvents } from "../types.js"

export * from "../types.js"

class IndexedDBMessageStore extends EventEmitter<MessageStoreEvents> implements MessageStore {
	public static version = 2
	public static async initialize(
		app: string,
		directory: string | null,
		sources: Set<string> = new Set([]),
		options: { verbose?: boolean } = {}
	): Promise<IndexedDBMessageStore> {
		assert(directory !== null)

		const db = await openDB(directory, IndexedDBMessageStore.version, {
			upgrade(database, oldVersion, newVersion, transaction, event) {
				for (const uri of [app, ...sources]) {
					if (!database.objectStoreNames.contains(uri)) {
						database.createObjectStore(uri)
					} else {
						database.deleteObjectStore(uri)
						database.createObjectStore(uri)
					}

					if (!database.objectStoreNames.contains(`${uri}/sessions`)) {
						database.createObjectStore(`${uri}/sessions`)
					} else {
						database.deleteObjectStore(`${uri}/sessions`)
						database.createObjectStore(`${uri}/sessions`)
					}

					if (!database.objectStoreNames.contains(`${uri}/mst`)) {
						database.createObjectStore(`${uri}/mst`)
					} else {
						database.deleteObjectStore(`${uri}/mst`)
						database.createObjectStore(`${uri}/mst`)
					}
				}
			},
		})

		const trees: Record<string, okra.Tree> = {}
		for (const uri of [app, ...sources]) {
			trees[uri] = await okra.Tree.open(db, `${uri}/mst`)
		}

		const store = new IndexedDBMessageStore(app, sources, db, trees, options)

		for (const uri of [app, ...sources]) {
			const { hash } = await trees[uri].read((txn) => txn.getRoot())
			store.merkleRoots[uri] = toHex(hash)
		}

		return store
	}

	private merkleRoots: Record<string, string> = {}

	private constructor(
		private readonly app: string,
		private readonly sources: Set<string>,
		private readonly db: IDBPDatabase,
		private readonly trees: Record<string, okra.Tree>,
		private readonly options: { verbose?: boolean }
	) {
		super()
	}

	public async close() {
		this.db.close()
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

	public async countMessages(type?: "action" | "session" | "customAction" | undefined): Promise<number> {
		throw Error("countMessages is not implemented in the browser")
	}

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))
		return this.trees[uri].read((txn) => callback(this.getReadOnlyTransaction(uri, txn)))
	}

	private getReadOnlyTransaction = (
		uri: string,
		txn: okra.ReadOnlyTransaction | okra.ReadWriteTransaction
	): ReadOnlyTransaction => ({
		uri,
		getSessionByAddress: async (chain, address) => {
			const id: Uint8Array | undefined = await this.db.get(`${uri}/sessions`, address)
			if (id === undefined) {
				return [null, null]
			}

			const message: Message | undefined = await this.db.get(uri, id)
			if (message === undefined || message.type !== "session") {
				throw new Error("internal error: inconsistent session address index")
			}

			return [toHex(id), message]
		},
		getMessage: async (id) => {
			const message: Message | undefined = await this.db.get(uri, id)
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
		const root = await this.trees[uri].write(async (txn) => {
			result = await callback(this.getReadWriteTransaction(uri, txn))
			return await txn.getRoot()
		})

		this.merkleRoots[uri] = toHex(root.hash)
		this.dispatchEvent(new CustomEvent("update", { detail: { uri: uri, root: null } }))
		return result!
	}

	private getReadWriteTransaction = (uri: string, txn: okra.ReadWriteTransaction): ReadWriteTransaction => ({
		...this.getReadOnlyTransaction(uri, txn),
		insertMessage: async (id, message) => {
			const key = getMessageKey(id, message)
			await txn.set(key, id)
			await this.db.put(uri, message, id)
			if (message.type === "session") {
				await this.db.put(`${uri}/sessions`, id, message.payload.sessionAddress)
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
