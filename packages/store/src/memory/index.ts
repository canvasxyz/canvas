import type { PeerId } from "@libp2p/interface-peer-id"

import PQueue from "p-queue"
import { MemoryTree } from "@canvas-js/okra-memory"
import type { KeyValueStore, Source, Target, Node } from "@canvas-js/okra"

import { AbstractStore } from "../AbstractStore.js"
import { IPLDValue, StoreInit } from "../interface.js"
import { assert } from "../utils.js"

export class MemoryStore<T extends IPLDValue> extends AbstractStore<T> {
	public static async open<T extends IPLDValue>(init: StoreInit<T>): Promise<MemoryStore<T>> {
		const tree = await MemoryTree.open({})
		return new MemoryStore<T>(tree, init)
	}

	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()

	private constructor(private readonly tree: MemoryTree, init: StoreInit<T>) {
		super(init)
	}

	protected async read(targetPeerId: PeerId, callback: (txn: Source) => Promise<void>) {
		if (targetPeerId !== null && this.outgoingSyncPeers.has(targetPeerId.toString())) {
			throw new Error(`deadlock with peer ${targetPeerId}`)
		}

		this.log("adding read-only transaction to queue")
		await this.queue.add(async () => {
			this.log("executing read-only transaction")

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

		this.log("adding read-write transaction to queue")
		await this.queue.add(async () => {
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
		})

		assert(root !== null, "internal error - transaction resolved prematurely")
		return { root }
	}
}

export const openStore = <T extends IPLDValue>(init: StoreInit<T>): Promise<AbstractStore<T>> => MemoryStore.open(init)
