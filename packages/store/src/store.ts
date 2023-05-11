import { decode, encode } from "microcbor"

import { Libp2p } from "libp2p"
import { Stream } from "@libp2p/interface-connection"
import { Message } from "@libp2p/interface-pubsub"
import { logger } from "@libp2p/logger"
import { PeerId } from "@libp2p/interface-peer-id"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"

import PQueue from "p-queue"
import { anySignal } from "any-signal"

import * as okra from "@canvas-js/okra-node"

import { Server, decodeRequests, encodeResponses, decodeResponses, encodeRequests, Client } from "./sync/index.js"
import { insertionRecordType } from "./codecs.js"
import { CacheMap, assert, wait } from "./utils.js"
import { DIAL_TIMEOUT, MAX_SYNC_QUEUE_SIZE, SYNC_COOLDOWN_PERIOD, SYNC_DELAY, SYNC_INTERVAL } from "./constants.js"

export interface StoreConfig {
	path: string
	name: string
	apply: (key: Uint8Array, value: Uint8Array) => Promise<void>
}

export class Store {
	public static async open(libp2p: Libp2p, config: StoreConfig): Promise<Store> {
		const store = new Store(libp2p, config)

		await libp2p.handle(store.protocol, ({ connection, stream }) =>
			store.handleIncomingStream(connection.remotePeer, stream)
		)

		return store
	}

	private readonly controller = new AbortController()

	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(MAX_SYNC_QUEUE_SIZE)

	private readonly log = logger("canvas:store")
	private readonly tree: okra.Tree
	private readonly topic: string
	private readonly protocol: string

	public constructor(private readonly libp2p: Libp2p, private readonly config: StoreConfig) {
		this.tree = new okra.Tree(config.path, {})

		this.topic = `/canvas/v0/store/${config.name}`
		this.protocol = `/canvas/v0/store/${config.name}/sync`

		this.libp2p.pubsub.addEventListener("message", this.handleMessage)
		this.libp2p.pubsub.addEventListener("subscription-change", ({ detail: { peerId, subscriptions } }) => {
			if (this.libp2p.peerId.equals(peerId)) {
				return
			}

			const subscription = subscriptions.find(({ topic }) => topic === this.topic)
			if (subscription === undefined) {
				return
			}

			if (subscription.subscribe) {
				this.log("peer %p joined the GossipSub topic %s", peerId, this.topic)
				this.schedulePeerSync(peerId)
			} else {
				this.log("peer %p left the GossipSub topic %s", peerId, this.topic)
			}
		})

		this.startSyncService()
	}

	public async insert(key: Uint8Array, value: Uint8Array): Promise<void> {
		await this.config.apply(key, value)
		await this.tree.write((txn) => txn.set(key, value))
		try {
			const data = encode({ key, value })
			const { recipients } = await this.libp2p.pubsub.publish(this.topic, data)
			this.log("published insertion to %d recipients", recipients.length)
		} catch (err) {
			this.log.error("failed to publish insertion record: %O", err)
		}
	}

	public async close(): Promise<void> {
		this.controller.abort()
		this.libp2p.pubsub.removeEventListener("message", this.handleMessage)
		await this.tree.close()
	}

	private async handleIncomingStream(peer: PeerId, stream: Stream) {
		this.log("opened incoming stream %s from peer %p", stream.id, peer)

		try {
			await this.tree.read(async (txn) => {
				const server = new Server(txn)
				await pipe(stream, lp.decode, decodeRequests, server.handle, encodeResponses, lp.encode, stream)
			})

			this.log("closed incoming stream %s from peer %p", stream.id, peer)
		} catch (err) {
			this.log.error("error handling incoming stream %s from peer %p: %O", stream.id, peer, err)
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error("internal error"))
			}

			this.log("aborted incoming stream %s from peer %p", stream.id, peer)
		}
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<Message>) => {
		if (msg.type !== "signed" && msg.topic !== this.topic) {
			return
		}

		let key: Uint8Array
		let value: Uint8Array
		try {
			const insertionRecord = decode(msg.data)
			assert(insertionRecordType.is(insertionRecord))
			key = insertionRecord.key
			value = insertionRecord.value
		} catch (err) {
			this.log.error("received invalid insertion record: %O", err)
			return
		}

		try {
			await this.config.apply(key, value)
		} catch (err) {
			this.log.error("failed to apply entry: %O", err)
			return
		}

		try {
			await this.tree.write((txn) => txn.set(key, value))
			this.log("successfully committed entry")
		} catch (err) {
			this.log.error("failed to commit entry: %O", err)
		}
	}

	private async startSyncService() {
		const log = logger("canvas:store:sync")
		const { signal } = this.controller

		try {
			await wait(SYNC_DELAY, { signal })
			while (!signal.aborted) {
				const subscribers = this.libp2p.pubsub.getSubscribers(this.topic)
				for (const peerId of subscribers) {
					this.schedulePeerSync(peerId)
				}

				await wait(SYNC_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				log("service aborted")
			} else {
				log.error("service crashed: %o", err)
			}
		}
	}

	private schedulePeerSync(peerId: PeerId) {
		if (this.libp2p.peerId.equals(peerId)) {
			return
		}

		const id = peerId.toString()
		if (this.syncQueuePeers.has(id)) {
			this.log("already queued sync for %p", peerId)
			return
		}

		if (this.syncQueue.size >= MAX_SYNC_QUEUE_SIZE) {
			this.log("sync queue is full")
			return
		}

		const lastSyncMark = this.syncHistory.get(id)
		if (lastSyncMark !== undefined) {
			const timeSinceLastSync = performance.now() - lastSyncMark

			this.log("Last sync with %p was %ds ago", peerId, Math.floor(timeSinceLastSync / 1000))
			if (timeSinceLastSync < SYNC_COOLDOWN_PERIOD) {
				return
			}
		}

		this.syncQueuePeers.add(id)
		this.syncQueue
			.add(() => this.sync(peerId))
			.then(() => this.syncHistory.set(id, performance.now()))
			.catch((err) => this.log.error("sync failed: %O", err))
			.finally(() => this.syncQueuePeers.delete(id))
	}

	private async sync(peerId: PeerId): Promise<void> {
		const dialTimeoutSignal = anySignal([AbortSignal.timeout(DIAL_TIMEOUT), this.controller.signal])
		const stream = await this.libp2p
			.dialProtocol(peerId, this.protocol, { signal: dialTimeoutSignal })
			.finally(() => dialTimeoutSignal.clear())

		// const client = new Client(stream)
		// await pipe(stream, lp.decode, decodeResponses, encodeRequests, lp.encode, stream)
	}
}
