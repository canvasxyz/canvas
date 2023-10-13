import type { PeerId } from "@libp2p/interface-peer-id"

import PQueue from "p-queue"
import pDefer from "p-defer"

import { Bound } from "@canvas-js/okra"
import { MemoryTree, MemoryStore } from "@canvas-js/okra-memory"

import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { assert } from "../utils.js"

export class GossipLog<Payload, Result> extends AbstractGossipLog<Payload, Result> {
	public static async open<Payload, Result>(init: GossipLogInit<Payload, Result>): Promise<GossipLog<Payload, Result>> {
		const messages = await MemoryTree.open()
		const parents = new MemoryStore()
		const ancestors = new MemoryStore()
		const gossipLog = new GossipLog(messages, parents, ancestors, init)

		if (init.replay) {
			await gossipLog.replay()
		}

		return gossipLog
	}

	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()

	private constructor(
		private readonly messages: MemoryTree,
		private readonly parents: MemoryStore,
		private readonly ancestors: MemoryStore,
		init: GossipLogInit<Payload, Result>
	) {
		super(init)
	}

	public async close() {
		this.log("closing")
		this.queue.clear()
		await this.queue.onIdle()
		await this.messages.store.close()
		await this.parents.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const deferred = pDefer()

		this.queue.add(() => {
			return deferred.promise
		})

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

		const result = await this.queue.add(async () => {
			if (targetPeerId !== null) {
				this.incomingSyncPeers.add(targetPeerId.toString())
			}

			try {
				return await callback({ messages: this.messages, parents: this.parents, ancestors: this.ancestors })
			} catch (err) {
				this.log.error("error in transaction: %O", err)
			} finally {
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

		const result = await this.queue.add(async () => {
			if (sourcePeerId !== null) {
				this.outgoingSyncPeers.add(sourcePeerId.toString())
			}

			try {
				return await callback({ messages: this.messages, parents: this.parents, ancestors: this.ancestors })
			} catch (err) {
				this.log.error("error in transaction: %O", err)
				throw err
			} finally {
				if (sourcePeerId !== null) {
					this.outgoingSyncPeers.delete(sourcePeerId.toString())
				}
			}
		})

		return result as T
	}
}
