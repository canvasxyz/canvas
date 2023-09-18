import type { PeerId } from "@libp2p/interface-peer-id"

import pDefer from "p-defer"
import { bytesToHex } from "@noble/hashes/utils"
import { IDBPDatabase, openDB } from "idb"
import { IDBStore, IDBTree } from "@canvas-js/okra-idb"
import { Bound, assert } from "@canvas-js/okra"

import openMemoryMessageLog from "../memory/index.js"

import {
	AbstractMessageLog,
	MessageLogInit,
	ReadOnlyTransaction,
	ReadWriteTransaction,
} from "../../AbstractMessageLog.js"

export * from "../../AbstractMessageLog.js"

export default async function openMessageLog<Payload, Result>(
	init: MessageLogInit<Payload, Result>
): Promise<AbstractMessageLog<Payload, Result>> {
	if (init.location === null) {
		return openMemoryMessageLog(init)
	}

	const storeNames = [`${init.topic}/messages`, `${init.topic}/parents`]
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

	const messages = await IDBTree.open(db, `${init.topic}/messages`)
	const parents = new IDBStore(db, `${init.topic}/parents`)

	return new Messagelog(init, db, messages, parents)
}

class Messagelog<Payload, Result> extends AbstractMessageLog<Payload, Result> {
	private readonly incomingSyncPeers = new Set<string>()
	private readonly outgoingSyncPeers = new Set<string>()
	private readonly controller = new AbortController()
	private readonly lockName = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))

	public constructor(
		init: MessageLogInit<Payload, Result>,
		private readonly db: IDBPDatabase,
		private readonly messages: IDBTree,
		private readonly parents: IDBStore
	) {
		super(init)
	}

	public async close() {
		this.controller.abort()
		this.db.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		this.log("requesting shared lock")
		const deferred = pDefer()

		navigator.locks.request(this.lockName, { mode: "shared", signal: this.controller.signal }, (lock) => {
			if (lock === null) {
				this.log.error("failed to acquire shared lock")
				throw new Error(`failed to acquire shared lock ${this.lockName}`)
			}

			this.log("acquired shared lock")
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
			this.log("releasing shared lock")
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

		let result: T | undefined = undefined

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
				result = await callback({ messages: this.messages, parents: this.parents })
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

				if (sourcePeerId !== null) {
					this.outgoingSyncPeers.add(sourcePeerId.toString())
				}

				try {
					result = await callback({ messages: this.messages, parents: this.parents })
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

		return result as T
	}
}
