import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import { openDB, IDBPDatabase } from "idb"

import { IDBTree } from "@canvas-js/okra-idb"

import type { Message, Session } from "@canvas-js/interfaces"

import { toHex, assert } from "@canvas-js/core/utils"
import { getMessageKey } from "@canvas-js/core/sync"

import type { MessageStore, ReadOnlyTransaction, ReadWriteTransaction, Node, MessageStoreEvents } from "../types.js"

export class IndexedDBMessageStore extends EventEmitter<MessageStoreEvents> implements MessageStore {
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

		const trees: Record<string, IDBTree> = {}
		for (const uri of [app, ...sources]) {
			trees[uri] = await IDBTree.open(db, `${uri}/mst`)
		}

		const store = new IndexedDBMessageStore(app, sources, db, trees, options)

		for (const uri of [app, ...sources]) {
			const { hash } = await trees[uri].getRoot()
			store.merkleRoots[uri] = toHex(hash)
		}

		return store
	}

	private static getLockName = (uri: string) => `canvas:[${uri}]`

	private merkleRoots: Record<string, string> = {}

	private constructor(
		private readonly app: string,
		private readonly sources: Set<string>,
		private readonly db: IDBPDatabase,
		private readonly trees: Record<string, IDBTree>,
		private readonly options: { verbose?: boolean }
	) {
		super()
	}

	public async close() {
		this.db.close()
	}

	public getMerkleRoots(): Record<string, string> {
		return { ...this.merkleRoots }
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

	private async getSessionByAddress(
		uri: string,
		chain: string,
		address: string
	): Promise<[hash: string | null, session: Session | null]> {
		const id: Uint8Array | undefined = await this.db.get(`${uri}/sessions`, address)
		if (id !== undefined) {
			const message: Message | undefined = await this.db.get(uri, id)
			if (message !== undefined && message.type === "session") {
				return [toHex(id), message]
			}
		}

		return [null, null]
	}

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))

		let result: T | undefined = undefined

		const lockName = IndexedDBMessageStore.getLockName(uri)
		await navigator.locks.request(lockName, { mode: "shared" }, async (lock) => {
			if (lock === null) {
				throw new Error("failed to acquire shared lock")
			} else {
				result = await callback(this.getReadOnlyTransaction(uri))
			}
		})

		return result!
	}

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => T | Promise<T>,
		options: { uri?: string } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		assert(uri === this.app || this.sources.has(uri))
		const tree = this.trees[uri]

		let result: T | undefined = undefined

		const lockName = IndexedDBMessageStore.getLockName(uri)
		await navigator.locks.request(lockName, { mode: "exclusive" }, async (lock) => {
			if (lock === null) {
				throw new Error("failed to acquire exclusive lock")
			}

			result = await callback(this.getReadWriteTransaction(uri))
			const root = await tree.getRoot()
			const hash = toHex(root.hash)
			if (this.merkleRoots[uri] !== hash) {
				this.merkleRoots[uri] = hash
				this.dispatchEvent(new CustomEvent("update", { detail: { uri: uri, root: hash } }))
			}
		})

		return result!
	}

	private async insertMessage(uri: string, id: Uint8Array, message: Message) {
		const key = getMessageKey(id, message)
		await this.trees[uri].set(key, id)
		await this.db.put(uri, message, id)
		if (message.type === "session") {
			await this.db.put(`${uri}/sessions`, id, message.payload.sessionAddress)
		}
	}

	private getReadOnlyTransaction = (uri: string): ReadOnlyTransaction => ({
		uri,
		source: this.trees[uri],
		getMessage: async (id) => this.db.get(uri, id) ?? null,
		getSessionByAddress: (chain, address) => this.getSessionByAddress(uri, chain, address),
	})

	private getReadWriteTransaction = (uri: string): ReadWriteTransaction => ({
		uri,
		target: this.trees[uri],
		getMessage: async (id) => this.db.get(uri, id) ?? null,
		getSessionByAddress: (chain, address) => this.getSessionByAddress(uri, chain, address),
		insertMessage: (id, message) => this.insertMessage(uri, id, message),
	})
}
