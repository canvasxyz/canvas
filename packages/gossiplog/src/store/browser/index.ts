import type { PeerId } from "@libp2p/interface-peer-id"

import { base32 } from "multiformats/bases/base32"
import { IDBPDatabase, openDB } from "idb"
import { IDBTree } from "@canvas-js/okra-idb"

import { openStore as openMemoryStore } from "../memory/index.js"

import { AbstractGraphStore, GraphStoreInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGraphStore.js"

export type { AbstractGraphStore, GraphStoreInit } from "../AbstractGraphStore.js"

export async function openStore(init: GraphStoreInit): Promise<AbstractGraphStore> {
	if (init.location === null) {
		return openMemoryStore(init)
	}

	const storeNames = [init.topic]
	const db = await openDB(init.location, 1, {
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

	const tree = await IDBTree.open(db, init.topic)

	return new Store(init, db, tree)
}

class Store extends AbstractGraphStore {
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly lockName: string
	private readonly controller = new AbortController()

	public constructor(init: GraphStoreInit, private readonly db: IDBPDatabase, private readonly tree: IDBTree) {
		super(init)
		this.lockName = base32.baseEncode(crypto.getRandomValues(new Uint8Array(10)))
	}

	public async close() {
		this.controller.abort()
		this.db.close()
	}

	public async source(targetPeerId: PeerId, callback: (txn: ReadOnlyTransaction) => Promise<void>) {
		if (this.outgoingSyncPeers.has(targetPeerId.toString())) {
			throw new Error(`deadlock with peer ${targetPeerId}`)
		}

		this.log("requesting shared lock")
		await navigator.locks.request(this.lockName, { mode: "shared", signal: this.controller.signal }, async (lock) => {
			if (lock === null) {
				this.log.error("failed to acquire shared lock")
				throw new Error(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")

			this.incomingSyncPeers.add(targetPeerId.toString())

			try {
				await callback(this.tree)
			} catch (err) {
				this.log.error("error in read-only transaction: %O", err)
			} finally {
				this.log("releasing shared lock")
				this.incomingSyncPeers.delete(targetPeerId.toString())
			}
		})
	}

	public async target(sourcePeerId: PeerId, callback: (txn: ReadWriteTransaction) => Promise<void>): Promise<void> {
		if (this.incomingSyncPeers.has(sourcePeerId.toString())) {
			throw new Error(`deadlock with peer ${sourcePeerId}`)
		}

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

				this.outgoingSyncPeers.add(sourcePeerId.toString())

				try {
					await callback(this.tree)
				} catch (err) {
					this.log.error("error in read-write transaction: %O", err)
					throw err
				} finally {
					this.log("releasing exclusive lock")
					this.outgoingSyncPeers.delete(sourcePeerId.toString())
				}
			}
		)
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T> {
		let result: T | undefined = undefined

		this.log("requesting shared lock")
		await navigator.locks.request(this.lockName, { mode: "shared", signal: this.controller.signal }, async (lock) => {
			if (lock === null) {
				this.log.error("failed to acquire shared lock")
				throw new Error(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")

			try {
				result = await callback(this.tree)
			} catch (err) {
				this.log.error("error in read-only transaction: %O", err)
				throw err
			} finally {
				this.log("releasing shared lock")
			}
		})

		return result as T
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
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

				try {
					result = await callback(this.tree)
				} catch (err) {
					this.log.error("error in read-write transaction: %O", err)
					throw err
				} finally {
					this.log("releasing exclusive lock")
				}
			}
		)

		return result as T
	}
}
