import { Libp2p } from "libp2p"
import { Stream } from "@libp2p/interface-connection"
import { Message } from "@libp2p/interface-pubsub"
import { PeerId } from "@libp2p/interface-peer-id"
import { Topology } from "@libp2p/interface-registrar"
import { createTopology } from "@libp2p/topology"
import { logger } from "@libp2p/logger"

import { Multiaddr } from "@multiformats/multiaddr"
import { pipe } from "it-pipe"
import * as lp from "it-length-prefixed"
import PQueue from "p-queue"
import { anySignal } from "any-signal"
import { bytesToHex as hex } from "@noble/hashes/utils"

import * as okra from "@canvas-js/okra-node"

import { Server, decodeRequests, encodeResponses, Client, Driver } from "./sync/index.js"
import { ServiceMap } from "./libp2p.js"
import { CacheMap, Entry, decodeEntry, encodeEntry, wait } from "./utils.js"
import { DIAL_TIMEOUT, MAX_SYNC_QUEUE_SIZE, SYNC_COOLDOWN_PERIOD, SYNC_DELAY, SYNC_INTERVAL } from "./constants.js"

export interface StoreConfig {
	path: string
	name: string
	apply: (key: Uint8Array, value: Uint8Array) => Promise<void>

	minConnections?: number
	maxConnections?: number
}

export class Store {
	public static MIN_CONNECTIONS = 2
	public static MAX_CONNECTIONS = 10

	public static async open(libp2p: Libp2p<ServiceMap>, config: StoreConfig): Promise<Store> {
		const store = new Store(libp2p, config)

		await libp2p.handle(store.protocol, ({ connection, stream }) =>
			store.handleIncomingStream(connection.remotePeer, stream)
		)

		const id = await libp2p.register(store.protocol, store.topology)

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
	private readonly topology: Topology

	private registrarId: string | null = null

	public constructor(private readonly libp2p: Libp2p<ServiceMap>, private readonly config: StoreConfig) {
		this.tree = new okra.Tree(config.path, {})

		this.topic = `/canvas/v0/store/${config.name}`
		this.protocol = `/canvas/v0/store/${config.name}/sync`

		this.topology = createTopology({
			onConnect: (peerId, connection) => {
				this.topology.peers.add(peerId.toString())
			},
			onDisconnect: (peerId) => {
				this.topology.peers.delete(peerId.toString())
			},
		})

		this.libp2p.register(this.protocol, this.topology).then((registrarId) => {
			this.registrarId = registrarId
		})

		const { pubsub } = this.libp2p.services
		pubsub.subscribe(this.topic)
		pubsub.addEventListener("message", this.handleMessage)
		pubsub.addEventListener("subscription-change", ({ detail: { peerId, subscriptions } }) => {
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

	public async get(key: Uint8Array): Promise<Uint8Array | null> {
		return await this.tree.read((txn) => txn.get(key))
	}

	public async insert(key: Uint8Array, value: Uint8Array): Promise<void> {
		const { pubsub } = this.libp2p.services

		await this.config.apply(key, value)
		await this.tree.write((txn) => txn.set(key, value))
		try {
			const data = encodeEntry({ key, value })
			const { recipients } = await pubsub.publish(this.topic, data)
			this.log("published insertion to %d recipients", recipients.length)
		} catch (err) {
			this.log.error("failed to publish insertion record: %O", err)
		}
	}

	public async close(): Promise<void> {
		const { pubsub } = this.libp2p.services

		pubsub.removeEventListener("message", this.handleMessage)

		await this.tree.close()
	}

	private async handleIncomingStream(peer: PeerId, stream: Stream) {
		this.log("opened incoming stream %s from peer %p", stream.id, peer)
		try {
			await this.tree.read(async (txn) => {
				const server = new Server(txn)
				await pipe(
					stream.source,
					lp.decode,
					decodeRequests,
					(reqs) => server.handle(reqs),
					encodeResponses,
					lp.encode,
					stream.sink
				)
			})

			this.log("closed incoming stream %s from peer %p", stream.id, peer)
		} catch (err) {
			this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peer, err)
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error("internal error"))
			}
		}
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<Message>) => {
		if (msg.type !== "signed" && msg.topic !== this.topic) {
			return
		}

		let entry: Entry | null = null
		try {
			entry = decodeEntry(msg.data)
		} catch (err) {
			this.log.error("received invalid insertion record: %O", err)
			return
		}

		const { key, value } = entry

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
		const { pubsub } = this.libp2p.services
		const { signal } = this.controller

		try {
			await wait(SYNC_DELAY, { signal })
			while (!signal.aborted) {
				const subscribers = pubsub.getSubscribers(this.topic)
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

	private schedulePeerSync(peerId: PeerId, addrs?: Multiaddr[]) {
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

			this.log("last sync with %p was %ds ago", peerId, Math.floor(timeSinceLastSync / 1000))
			if (timeSinceLastSync < SYNC_COOLDOWN_PERIOD) {
				return
			}
		}

		this.syncQueuePeers.add(id)
		this.syncQueue
			.add(() => this.sync(peerId, addrs))
			.then(() => this.syncHistory.set(id, performance.now()))
			.catch((err) => this.log.error("sync failed: %O", err))
			.finally(() => this.syncQueuePeers.delete(id))
	}

	private async sync(peerId: PeerId, addrs?: Multiaddr[]): Promise<void> {
		const log = logger("canvas:sync")
		log("dialing %p", peerId)

		const dialTimeoutSignal = anySignal([AbortSignal.timeout(DIAL_TIMEOUT), this.controller.signal])
		const stream = await this.libp2p
			.dialProtocol(addrs ?? peerId, this.protocol, { signal: dialTimeoutSignal })
			.finally(() => dialTimeoutSignal.clear())

		try {
			log("opened outgoing stream %s to peer %p", stream.id, peerId)
			await this.tree.write(async (txn) => {
				log("opened read-write transaction")
				const client = new Client(stream)
				const driver = new Driver(client, txn)
				try {
					for await (const [key, value] of driver.sync()) {
						log("got entry %s: %s", hex(key), hex(value))
						try {
							await this.config.apply(key, value)
						} catch (err) {
							log.error("failed to apply entry: %O", err)
							continue
						}

						await txn.set(key, value)
					}

					log("committing transaction")
				} catch (err) {
					console.error(err)
					console.trace("fjdkslafjdkls")
				} finally {
					client.end()
				}
			})
		} catch (err) {
			log.error("sync failed: %O", err)
		} finally {
			stream.close()
			log("closed outgoing stream %s to peer %p", stream.id, peerId)
		}
	}
}
