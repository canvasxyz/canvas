import pDefer from "p-defer"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { equals } from "uint8arrays"
import { IDBPDatabase, openDB } from "idb"

import { Bound } from "@canvas-js/okra"
import { IDBStore, IDBTree } from "@canvas-js/okra-idb"
import { Message, Signature } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { KEY_LENGTH, encodeId, encodeSignedMessage } from "../schema.js"
import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { SyncDeadlockError, SyncResourceError, cborNull } from "../utils.js"
import { getAncestors, indexAncestors, isAncestor } from "../ancestors.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(init: GossipLogInit<Payload>): Promise<GossipLog<Payload>> {
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
		init: GossipLogInit<Payload>,
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

		// wait up to 500ms for the lock to free up
		if (this.controller.signal) {
			await new Promise((resolve) => setTimeout(resolve, 500))
			this.controller.abort()
		} else {
			this.controller.abort()
		}

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
				throw new SyncResourceError(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")
			return deferred.promise
		})

		if (this.messages.store.txn === null) {
			this.messages.store.txn = this.db.transaction(this.messages.store.storeName, "readonly")
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
				throw new SyncDeadlockError(`deadlock with peer ${targetId}`)
			}
		}

		let result: T | undefined = undefined

		this.log("requesting shared lock")
		await navigator.locks.request(this.lockName, { mode: "shared", signal: this.controller.signal }, async (lock) => {
			if (lock === null) {
				this.log.error("failed to acquire shared lock")
				throw new SyncResourceError(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")

			if (targetId !== null) {
				this.incomingSyncPeers.add(targetId)
			}

			try {
				result = await callback({
					getHeads: () => this.heads.read(() => getHeads(this.heads)),
					getAncestors: (key: Uint8Array, atOrBefore: number, results: Set<string>) =>
						this.ancestors.read(() => getAncestors(this.ancestors, key, atOrBefore, results)),
					isAncestor: (key: Uint8Array, ancestorKey: Uint8Array, visited = new Set<string>()) =>
						this.ancestors.read(() => isAncestor(this.ancestors, key, ancestorKey, visited)),

					messages: this.messages,
				})
			} catch (err) {
				if (err instanceof Error && err.name === "TransactionInactiveError") {
					this.log.error("incoming merkle sync attempted, but transaction was invalid") // TODO: better txn handling
				} else if (err instanceof Error && err.name === "Error" && err.message === "TIMEOUT") {
					this.log.error("incoming merkle sync reached timeout") // TODO: this should be happening less
				} else {
					this.log.error("error in read-only transaction: %O", err)
				}
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
				throw new SyncDeadlockError(`deadlock with peer ${sourceId}`)
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
					throw new SyncResourceError(`failed to acquire exclusive lock ${this.lockName}`)
				}

				this.log("acquired exclusive lock")

				if (sourceId !== null) {
					this.outgoingSyncPeers.add(sourceId)
				}

				try {
					result = await callback({
						getHeads: () => this.heads.read(() => getHeads(this.heads)),
						getAncestors: (key: Uint8Array, atOrBefore: number, results: Set<string>) =>
							this.ancestors.read(() => getAncestors(this.ancestors, key, atOrBefore, results)),
						isAncestor: (key: Uint8Array, ancestorKey: Uint8Array, visited = new Set<string>()) =>
							this.ancestors.read(() => isAncestor(this.ancestors, key, ancestorKey, visited)),

						insert: async (
							id: string,
							signature: Signature,
							message: Message,
							[key, value] = encodeSignedMessage(signature, message),
						) => {
							await this.messages.set(key, value)

							const parentKeys = message.parents.map(encodeId)

							await this.heads.write(async () => {
								await this.heads.set(key, cborNull)
								for (const parentKey of parentKeys) {
									await this.heads.delete(parentKey)
								}
							})

							if (this.indexAncestors) {
								await this.ancestors.write(() => indexAncestors(this.ancestors, key, parentKeys))
							}
						},

						messages: this.messages,
					})
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

async function getHeads(heads: IDBStore) {
	const parents: Uint8Array[] = []

	for await (const [key, value] of heads.entries()) {
		assert(key.byteLength === KEY_LENGTH, "internal error (expected key.byteLength === KEY_LENGTH)")
		assert(equals(value, cborNull), "internal error (unexpected parent entry value)")
		parents.push(key)
	}

	return parents
}
