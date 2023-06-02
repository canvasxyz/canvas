import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { PeerId } from "@libp2p/interface-peer-id"

import type { KeyValueStore, Source, Target } from "@canvas-js/okra"
import { IDBTree } from "@canvas-js/okra-idb"
import { openDB } from "idb"

import { AbstractStore, Store, StoreInit } from "../store.js"

class IDBStore extends AbstractStore {
	public static async open(libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit): Promise<IDBStore> {
		const storeNames = [init.topic]
		const db = await openDB(init.topic, 1, {
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
		const store = new IDBStore(libp2p, init, tree)
		store.controller.signal.addEventListener("abort", () => db.close())
		return store
	}

	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly lockName: string

	private constructor(libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit, private readonly tree: IDBTree) {
		super(libp2p, init)
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
	) {
		if (sourcePeerId !== null && this.incomingSyncPeers.has(sourcePeerId.toString())) {
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
				} else {
					this.log("acquired exclusive lock")

					if (sourcePeerId !== null) {
						this.outgoingSyncPeers.add(sourcePeerId.toString())
					}

					try {
						await callback(this.tree)
					} catch (err) {
						this.log.error("error in read-write transaction: %O", err)
					} finally {
						this.log("releasing exclusive lock")
						if (sourcePeerId !== null) {
							this.outgoingSyncPeers.delete(sourcePeerId.toString())
						}
					}
				}
			}
		)
	}
}

export const openStore = (libp2p: Libp2p<{ pubsub: PubSub }>, init: StoreInit): Promise<Store> =>
	IDBStore.open(libp2p, init)
