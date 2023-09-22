import type { PeerId } from "@libp2p/interface-peer-id"

import pDefer from "p-defer"
import { bytesToHex } from "@noble/hashes/utils"

import { IDBPDatabase, openDB } from "idb"
import { IDBStore, IDBTree } from "@canvas-js/okra-idb"
import { Bound, KeyValueStore } from "@canvas-js/okra"

import { AbstractMessageLog, MessageLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractMessageLog.js"
import { assert } from "../utils.js"

export class MessageLog<Payload, Result> extends AbstractMessageLog<Payload, Result> {
	public static async open<Payload, Result>(
		name: string,
		init: MessageLogInit<Payload, Result>
	): Promise<MessageLog<Payload, Result>> {
		const storeNames = [`${init.topic}/messages`, `${init.topic}/parents`]
		const db = await openDB(name, 1, {
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

		const messages = await IDBTree.open(db, `${init.topic}/messages`)
		const parents = new IDBStore(db, `${init.topic}/parents`)

		return new MessageLog(init, db, messages, parents, storeNames)
	}

	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly controller = new AbortController()
	private readonly lockName = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))

	private constructor(
		init: MessageLogInit<Payload, Result>,
		private readonly db: IDBPDatabase,
		private readonly messages: IDBTree,
		private readonly parents: IDBStore,
		private readonly storeNames: string[]
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
		options: { reverse?: boolean } = {}
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
			this.messages.store.txn = this.db.transaction([`${this.topic}/messages`], "readonly")
		}

		try {
			for await (const node of this.messages.nodes(
				0,
				lowerBound ?? { key: null, inclusive: false },
				upperBound,
				options
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
		options: { target?: PeerId } = {}
	): Promise<T> {
		const targetPeerId = options.target ?? null

		if (targetPeerId !== null) {
			if (this.outgoingSyncPeers.has(targetPeerId.toString())) {
				throw new Error(`deadlock with peer ${targetPeerId}`)
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

			if (targetPeerId !== null) {
				this.incomingSyncPeers.add(targetPeerId.toString())
			}

			const parents: Omit<KeyValueStore, "set" | "delete"> = {
				get: (key) => this.parents.read(() => this.parents.get(key)),
				entries: (lowerBound = null, upperBound = null, options = {}) => {
					this.parents.txn = this.db.transaction([`${this.topic}/parents`], "readonly")
					return this.parents.entries(lowerBound, upperBound, options)
				},
			}

			try {
				result = await callback({ messages: this.messages, parents })
			} catch (err) {
				this.log.error("error in read-only transaction: %O", err)
			} finally {
				this.log("releasing shared lock")
				if (targetPeerId !== null) {
					this.incomingSyncPeers.delete(targetPeerId.toString())
				}
			}
		})

		return result as T
	}

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => Promise<T>,
		options: { source?: PeerId } = {}
	): Promise<T> {
		const sourcePeerId = options.source ?? null
		if (sourcePeerId !== null) {
			if (this.incomingSyncPeers.has(sourcePeerId.toString())) {
				throw new Error(`deadlock with peer ${sourcePeerId}`)
			}
		}

		let result: T | undefined = undefined

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

				if (sourcePeerId !== null) {
					this.outgoingSyncPeers.add(sourcePeerId.toString())
				}

				const parents: KeyValueStore = {
					get: (key) => this.parents.read(() => this.parents.get(key)),
					set: (key, value) => this.parents.write(() => this.parents.set(key, value)),
					delete: (key) => this.parents.write(() => this.parents.delete(key)),
					entries: (lowerBound = null, upperBound = null, options = {}) => {
						this.parents.txn = this.db.transaction([`${this.topic}/parents`], "readonly")
						return this.parents.entries(lowerBound, upperBound, options)
					},
				}

				try {
					result = await callback({ messages: this.messages, parents })
				} catch (err) {
					this.log.error("error in read-write transaction: %O", err)
					throw err
				} finally {
					this.log("releasing exclusive lock")
					if (sourcePeerId !== null) {
						this.outgoingSyncPeers.delete(sourcePeerId.toString())
					}
				}
			}
		)

		return result as T
	}
}
