import type { PeerId } from "@libp2p/interface-peer-id"

import { openDB } from "idb"
import { IDBTree } from "@canvas-js/okra-idb"
import type { KeyValueStore, Source, Target, Node } from "@canvas-js/okra"

import { AbstractStore } from "../AbstractStore.js"
import { IPLDValue, Store, StoreInit } from "../interface.js"
import { assert } from "../utils.js"

export class BrowserStore<T extends IPLDValue> extends AbstractStore<T> {
	public static async open<T extends IPLDValue>(name: string, init: StoreInit<T>): Promise<BrowserStore<T>> {
		const storeNames = [init.topic]
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

		const tree = await IDBTree.open(db, init.topic)
		const store = new BrowserStore<T>(tree, init)
		store.controller.signal.addEventListener("abort", () => db.close())
		return store
	}

	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly lockName: string

	private constructor(private readonly tree: IDBTree, init: StoreInit<T>) {
		super(init)
		this.lockName = `${this.topic}/lock`
	}

	protected async read(targetPeerId: PeerId, callback: (txn: Source) => Promise<void>) {
		if (targetPeerId !== null && this.outgoingSyncPeers.has(targetPeerId.toString())) {
			throw new Error(`deadlock with peer ${targetPeerId}`)
		}

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

			try {
				await callback(this.tree)
			} catch (err) {
				this.log.error("error in read-only transaction: %O", err)
			} finally {
				this.log("releasing shared lock")
				if (targetPeerId !== null) {
					this.incomingSyncPeers.delete(targetPeerId.toString())
				}
			}
		})
	}

	protected async write(
		sourcePeerId: PeerId,
		callback: (txn: Target & Pick<KeyValueStore, "get" | "set" | "delete">) => Promise<void>
	): Promise<{ root: Node }> {
		if (sourcePeerId !== null && this.incomingSyncPeers.has(sourcePeerId.toString())) {
			throw new Error(`deadlock with peer ${sourcePeerId}`)
		}

		let root: Node | null = null

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

				try {
					await callback(this.tree)
					root = await this.tree.getRoot()
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

		assert(root !== null, "internal error - lock released before transaction completed")
		return { root }
	}
}

export const openStore = <T extends IPLDValue>(name: string, init: StoreInit<T>): Promise<Store<T>> =>
	BrowserStore.open(name, init)
