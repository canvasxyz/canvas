import type { PeerId } from "@libp2p/interface-peer-id"

import PQueue from "p-queue"
import { MemoryTree } from "@canvas-js/okra-memory"

import { AbstractMessageLog, MessageLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractStore.js"

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

		this.log("adding read-only transaction to queue")
		const result = await this.queue.add(async () => {
			this.log("executing read-only transaction")
			if (targetPeerId !== null) {
				this.incomingSyncPeers.add(targetPeerId.toString())
			}

			try {
				return await callback(this.tree)
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

		this.log("adding read-write transaction to queue")
		const result = await this.queue.add(async () => {
			if (sourcePeerId !== null) {
				this.outgoingSyncPeers.add(sourcePeerId.toString())
			}

			try {
				return await callback(this.tree)
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

		return result as T
	}
}
