import type { PeerId } from "@libp2p/interface-peer-id"

import PQueue from "p-queue"
import pDefer from "p-defer"

import { MemoryTree } from "@canvas-js/okra-memory"
import { Bound, assert } from "@canvas-js/okra"

import { AbstractMessageLog, MessageLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractMessageLog.js"

export default async function openMessageLog<Payload, Result>(
	init: MessageLogInit<Payload, Result>
): Promise<AbstractMessageLog<Payload, Result>> {
	const tree = await MemoryTree.open()
	return new MessageLog(init, tree)
}

class MessageLog<Payload, Result> extends AbstractMessageLog<Payload, Result> {
	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()

	constructor(init: MessageLogInit<Payload, Result>, private readonly tree: MemoryTree) {
		super(init)
	}

	public async close() {}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const deferred = pDefer()

		this.log("adding transaction to queue")
		this.queue.add(() => {
			this.log("beginning transaction")
			return deferred.promise
		})

		try {
			for await (const node of this.tree.nodes(0, lowerBound ?? { key: null, inclusive: false }, upperBound, options)) {
				assert(node.key !== null, "expected node.key !== null")
				assert(node.value !== undefined, "expected node.value !== undefined")
				yield [node.key, node.value]
			}
		} finally {
			this.log("transaction completed")
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

		this.log("adding transaction to queue")
		const result = await this.queue.add(async () => {
			this.log("beginning transaction")

			if (targetPeerId !== null) {
				this.incomingSyncPeers.add(targetPeerId.toString())
			}

			try {
				return await callback(this.tree)
			} catch (err) {
				this.log.error("error in transaction: %O", err)
			} finally {
				this.log("transaction completed")
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

		this.log("adding transaction to queue")
		const result = await this.queue.add(async () => {
			this.log("beginning transaction")

			if (sourcePeerId !== null) {
				this.outgoingSyncPeers.add(sourcePeerId.toString())
			}

			try {
				return await callback(this.tree)
			} catch (err) {
				this.log.error("error in transaction: %O", err)
				throw err
			} finally {
				this.log("transaction completed")
				if (sourcePeerId !== null) {
					this.outgoingSyncPeers.delete(sourcePeerId.toString())
				}
			}
		})

		return result as T
	}
}
