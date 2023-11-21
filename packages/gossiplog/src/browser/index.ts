import pDefer from "p-defer"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { Bound, KeyValueStore } from "@canvas-js/okra"
import { IDBStore, IDBTree } from "@canvas-js/okra-idb"
import { IDBPDatabase, openDB } from "idb"

import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { assert } from "../utils.js"

export class GossipLog<Payload, Result> extends AbstractGossipLog<Payload, Result> {
	public static async open<Payload, Result>(init: GossipLogInit<Payload, Result>): Promise<GossipLog<Payload, Result>> {
		const storeNames = ["messages", "heads", "ancestors"]
		const db = await openDB(`canvas/${init.topic}/log`, 2, {
			upgrade: (db, oldVersion, newVersion) => {
				for (const storeName of storeNames) {
					if (db.objectStoreNames.contains(storeName)) {
						continue
					} else {
						db.createObjectStore(storeName)
					}
				}
			},
		})

		const messages = await IDBTree.open(db, "messages")
		const heads = new IDBStore(db, "heads")
		const ancestors = new IDBStore(db, "ancestors")

		return new GossipLog(db, messages, heads, ancestors, init)
	}

	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly controller = new AbortController()
	private readonly lockName = bytesToHex(randomBytes(16))

	private constructor(
		private readonly db: IDBPDatabase,
		private readonly messages: IDBTree,
		private readonly heads: IDBStore,
		private readonly ancestors: IDBStore,
		init: GossipLogInit<Payload, Result>,
	) {
		super(init)

		db.addEventListener("error", (event) => this.log("db: error", event))
		db.addEventListener("close", (event) => this.log("db: close", event))
		db.addEventListener("versionchange", (event) => {
			this.log("db: versionchange", event)
			if (event.oldVersion === null && event.newVersion !== null) {
				// create
				return
			} else if (event.oldVersion !== null && event.newVersion !== null) {
				// update
				return
			} else if (event.oldVersion !== null && event.newVersion === null) {
				// delete
				db.close()
				return
			}
		})
	}

	public async close() {
		this.log("closing")
		this.controller.abort()
		this.db.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		this.log("requesting shared lock")
		const deferred = pDefer()

		navigator.locks.request(this.lockName, { mode: "shared", signal: this.controller.signal }, (lock) => {
			if (lock === null) {
				this.log.error("failed to acquire shared lock")
				throw new Error(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")
			return deferred.promise
		})

		if (this.messages.store.txn === null) {
			this.messages.store.txn = this.db.transaction([this.messages.store.storeName], "readonly")
		}

		try {
			for await (const node of this.messages.nodes(
				0,
				lowerBound ?? { key: null, inclusive: false },
				upperBound,
				options,
			)) {
				assert(node.key !== null, "expected node.key !== null")
				assert(node.value !== undefined, "expected node.value !== undefined")
				yield [node.key, node.value]
			}
		} finally {
			this.messages.store.txn = null
			this.log("releasing shared lock")
			deferred.resolve()
		}
	}

	public async read<T>(
		callback: (txn: ReadOnlyTransaction) => Promise<T>,
		options: { targetId?: string } = {},
	): Promise<T> {
		const targetId = options.targetId ?? null

		if (targetId !== null) {
			if (this.outgoingSyncPeers.has(targetId)) {
				throw new Error(`deadlock with peer ${targetId}`)
			}
		}

		let result: T | undefined = undefined

		this.log("requesting shared lock")
		await navigator.locks.request(this.lockName, { mode: "shared", signal: this.controller.signal }, async (lock) => {
			if (lock === null) {
				this.log.error("failed to acquire shared lock")
				throw new Error(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")

			if (targetId !== null) {
				this.incomingSyncPeers.add(targetId)
			}

			const heads: Omit<KeyValueStore, "set" | "delete"> = {
				get: (key) => this.heads.read(() => this.heads.get(key)),
				entries: (lowerBound = null, upperBound = null, options = {}) => {
					console.log("GETTING PARENTS READ-ONLY", this.heads.storeName)
					this.heads.txn = this.db.transaction([this.heads.storeName], "readonly")
					return this.heads.entries(lowerBound, upperBound, options)
				},
			}

			const ancestors: Omit<KeyValueStore, "set" | "delete"> = {
				get: (key) => this.ancestors.read(() => this.ancestors.get(key)),
				entries: (lowerBound = null, upperBound = null, options = {}) => {
					this.ancestors.txn = this.db.transaction([this.ancestors.storeName], "readonly")
					return this.ancestors.entries(lowerBound, upperBound, options)
				},
			}

			try {
				result = await callback({ messages: this.messages, heads, ancestors })
			} catch (err) {
				this.log.error("error in read-only transaction: %O", err)
			} finally {
				this.log("releasing shared lock")
				if (targetId !== null) {
					this.incomingSyncPeers.delete(targetId)
				}
			}
		})

		return result as T
	}

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => Promise<T>,
		options: { sourceId?: string } = {},
	): Promise<T> {
		const sourceId = options.sourceId ?? null
		if (sourceId !== null) {
			if (this.incomingSyncPeers.has(sourceId)) {
				throw new Error(`deadlock with peer ${sourceId}`)
			}
		}

		let result: T | undefined = undefined
		let error: Error | null = null

		this.log("requesting exclusive lock")
		await navigator.locks.request(
			this.lockName,
			{ mode: "exclusive", signal: this.controller.signal },
			async (lock) => {
				if (lock === null) {
					this.log.error("failed to exclusive lock")
					throw new Error(`failed to acquire exclusive lock ${this.lockName}`)
				}

				this.log("acquired exclusive lock")

				if (sourceId !== null) {
					this.outgoingSyncPeers.add(sourceId)
				}

				const heads: KeyValueStore = {
					get: (key) => this.heads.read(() => this.heads.get(key)),
					set: (key, value) => this.heads.write(() => this.heads.set(key, value)),
					delete: (key) => this.heads.write(() => this.heads.delete(key)),
					entries: (lowerBound = null, upperBound = null, options = {}) => {
						this.heads.txn = this.db.transaction(this.heads.storeName, "readonly")
						return this.heads.entries(lowerBound, upperBound, options)
					},
				}

				const ancestors: KeyValueStore = {
					get: (key) => this.ancestors.read(() => this.ancestors.get(key)),
					set: (key, value) => this.ancestors.write(() => this.ancestors.set(key, value)),
					delete: (key) => this.ancestors.write(() => this.ancestors.delete(key)),
					entries: (lowerBound = null, upperBound = null, options = {}) => {
						this.ancestors.txn = this.db.transaction(this.ancestors.storeName, "readonly")
						return this.ancestors.entries(lowerBound, upperBound, options)
					},
				}

				try {
					result = await callback({ messages: this.messages, heads, ancestors })
				} catch (err) {
					this.log.error("error in read-write transaction: %O", err)
					error = err as Error
					throw err
				} finally {
					this.log("releasing exclusive lock")
					if (sourceId !== null) {
						this.outgoingSyncPeers.delete(sourceId)
					}
				}
			},
		)

		// this is just a workaround for fake-indexeddb which doesn't throw exceptions right
		if (error !== null) {
			throw error
		}

		return result as T
	}
}
