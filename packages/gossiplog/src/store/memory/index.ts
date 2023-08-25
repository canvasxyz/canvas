import type { PeerId } from "@libp2p/interface-peer-id"

import PQueue from "p-queue"
import { MemoryTree } from "@canvas-js/okra-memory"

import { AbstractStore, StoreInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractStore.js"

export { AbstractStore, StoreInit, Graph } from "../AbstractStore.js"

export async function openStore(init: StoreInit): Promise<AbstractStore> {
	const tree = await MemoryTree.open()
	return new Store(init, tree)
}

class Store extends AbstractStore {
	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()

	constructor(init: StoreInit, private readonly tree: MemoryTree) {
		super(init)
	}

	public async close() {}

	public async source(targetPeerId: PeerId, callback: (txn: ReadOnlyTransaction) => Promise<void>) {
		if (this.outgoingSyncPeers.has(targetPeerId.toString())) {
			throw new Error(`deadlock with peer ${targetPeerId}`)
		}

		this.log("adding read-only transaction to queue")
		await this.queue.add(async () => {
			this.log("executing read-only transaction")
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

	public async target<T>(sourcePeerId: PeerId, callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		if (this.incomingSyncPeers.has(sourcePeerId.toString())) {
			throw new Error(`deadlock with peer ${sourcePeerId}`)
		}

		this.log("adding read-write transaction to queue")
		const result = await this.queue.add(async () => {
			this.outgoingSyncPeers.add(sourcePeerId.toString())
			try {
				return await callback(this.tree)
			} catch (err) {
				this.log.error("error in read-write transaction: %O", err)
				throw err
			} finally {
				this.log("releasing exclusive lock")
				this.outgoingSyncPeers.delete(sourcePeerId.toString())
			}
		})

		return result as T
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>) {
		this.log("adding read-only transaction to queue")
		const result = await this.queue.add(async () => {
			this.log("executing read-only transaction")
			try {
				return await callback(this.tree)
			} catch (err) {
				this.log.error("error in read-only transaction: %O", err)
				throw err
			} finally {
				this.log("exiting read-only transaction")
			}
		})

		return result as T
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		this.log("adding read-write transaction to queue")
		const result = await this.queue.add(async () => {
			try {
				return await callback(this.tree)
			} catch (err) {
				this.log.error("error in read-write transaction: %O", err)
				throw err
			} finally {
				this.log("exiting read-write transaction")
			}
		})

		return result as T
	}
}
