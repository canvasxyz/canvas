import PQueue from "p-queue"
import pDefer from "p-defer"

import { Bound } from "@canvas-js/okra"
import { MemoryTree, MemoryStore } from "@canvas-js/okra-memory"

import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { assert } from "../utils.js"

export class GossipLog<Payload, Result> extends AbstractGossipLog<Payload, Result> {
	public static async open<Payload, Result>(init: GossipLogInit<Payload, Result>): Promise<GossipLog<Payload, Result>> {
		const messages = await MemoryTree.open()
		const heads = new MemoryStore()
		const ancestors = new MemoryStore()
		return new GossipLog(messages, heads, ancestors, init)
	}

	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()

	private constructor(
		private readonly messages: MemoryTree,
		private readonly heads: MemoryStore,
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
		await this.heads.close()
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
		options: { targetId?: string } = {}
	): Promise<T> {
		const targetId = options.targetId ?? null

		if (targetId !== null) {
			if (this.outgoingSyncPeers.has(targetId)) {
				throw new Error(`deadlock with peer ${targetId}`)
			}
		}

		const result = await this.queue.add(async () => {
			if (targetId !== null) {
				this.incomingSyncPeers.add(targetId)
			}

			try {
				return await callback({ messages: this.messages, heads: this.heads, ancestors: this.ancestors })
			} catch (err) {
				this.log.error("error in transaction: %O", err)
			} finally {
				if (targetId !== null) {
					this.incomingSyncPeers.delete(targetId)
				}
			}
		})

		return result as T
	}

	public async write<T>(
		callback: (txn: ReadWriteTransaction) => Promise<T>,
		options: { sourceId?: string } = {}
	): Promise<T> {
		const sourceId = options.sourceId ?? null
		if (sourceId !== null) {
			if (this.incomingSyncPeers.has(sourceId)) {
				throw new Error(`deadlock with peer ${sourceId}`)
			}
		}

		const result = await this.queue.add(async () => {
			if (sourceId !== null) {
				this.outgoingSyncPeers.add(sourceId)
			}

			try {
				return await callback({ messages: this.messages, heads: this.heads, ancestors: this.ancestors })
			} catch (err) {
				this.log.error("error in transaction: %O", err)
				throw err
			} finally {
				if (sourceId !== null) {
					this.outgoingSyncPeers.delete(sourceId)
				}
			}
		})

		return result as T
	}
}
