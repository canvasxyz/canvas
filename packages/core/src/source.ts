import chalk from "chalk"
import PQueue from "p-queue"
import { sha256 } from "@noble/hashes/sha256"
import { anySignal } from "any-signal"

import type { Libp2p } from "libp2p"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { StreamHandler } from "@libp2p/interface-registrar"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { CID } from "multiformats/cid"
import { Multiaddr } from "@multiformats/multiaddr"

import type { Message } from "@canvas-js/interfaces"
import type { MessageStore, ReadWriteTransaction } from "@canvas-js/core/components/messageStore"

import {
	DIAL_TIMEOUT,
	MAX_PING_QUEUE_SIZE,
	SYNC_COOLDOWN_PERIOD,
	DHT_DISCOVERY_DELAY,
	DHT_DISCOVERY_RETRY_INTERVAL,
	DHT_DISCOVERY_INTERVAL,
	DHT_DISCOVERY_TIMEOUT,
	DHT_ANNOUNCE_DELAY,
	DHT_ANNOUNCE_INTERVAL,
	DHT_ANNOUNCE_RETRY_INTERVAL,
	DHT_ANNOUNCE_TIMEOUT,
	MIN_MESH_PEERS,
} from "@canvas-js/core/constants"
import { messageType } from "@canvas-js/core/codecs"
import { toHex, assert, logErrorMessage, CacheMap, wait, retry } from "@canvas-js/core/utils"
import { sync, handleIncomingStream } from "@canvas-js/core/sync"

export interface SourceOptions {
	verbose?: boolean
}

export interface SourceConfig extends SourceOptions {
	cid: CID
	messageStore: MessageStore
	libp2p: Libp2p
	applyMessage: (txn: ReadWriteTransaction, hash: Uint8Array, message: Message) => Promise<void>
	signal: AbortSignal
}

interface SourceEvents {
	sync: CustomEvent<{ peer: string; time: number; status: "success" | "failure" }>
}

export class Source extends EventEmitter<SourceEvents> {
	private readonly controller = new AbortController()
	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly pendingSyncPeers = new Set<string>()
	private readonly syncHistory = new CacheMap<string, number>(MAX_PING_QUEUE_SIZE)

	private readonly cid: CID
	private readonly messageStore: MessageStore
	private readonly libp2p: Libp2p
	private readonly applyMessage: (txn: ReadWriteTransaction, hash: Uint8Array, message: Message) => Promise<void>
	private readonly options: SourceOptions
	private readonly prefix: string

	public constructor(config: SourceConfig) {
		super()
		const { cid, libp2p, messageStore, applyMessage, signal, ...options } = config
		this.cid = cid
		this.libp2p = libp2p
		this.messageStore = messageStore
		this.applyMessage = applyMessage
		this.options = options
		this.prefix = `[canvas-core] [${this.cid}]`

		signal.addEventListener("abort", () => {
			this.controller.abort()
			this.syncQueue.pause()
			this.syncQueue.clear()
		})

		this.libp2p.peerStore.addEventListener("change:protocols", ({ detail: { peerId, oldProtocols, protocols } }) => {
			if (this.libp2p.peerId.equals(peerId)) {
				return
			}

			const oldProtocolSet = new Set(oldProtocols)
			const newProtocolSet = new Set(protocols.filter((protocol) => !oldProtocolSet.has(protocol)))
			if (newProtocolSet.has(this.protocol)) {
				if (this.options.verbose) {
					console.log(chalk.gray(this.prefix, `Peer ${peerId} supports the ${this.protocol} protocol`))
				}

				this.schedulePeerSync(peerId)
			}
		})

		this.libp2p.pubsub.addEventListener("message", this.handleGossipMessage)
		this.libp2p.pubsub.addEventListener("subscription-change", ({ detail: { peerId, subscriptions } }) => {
			if (this.libp2p.peerId.equals(peerId)) {
				return
			}

			const subscription = subscriptions.find(({ topic }) => topic === this.uri)
			if (subscription === undefined) {
				return
			}

			if (subscription.subscribe) {
				if (this.options.verbose) {
					console.log(chalk.gray(this.prefix, `Peer ${peerId} joined the GossipSub topic`))
				}

				this.schedulePeerSync(peerId)
			} else {
				if (this.options.verbose) {
					console.log(chalk.gray(this.prefix, `Peer ${peerId} left the GossipSub topic`))
				}
			}
		})
	}

	public async start() {
		this.libp2p.pubsub.subscribe(this.uri)
		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Subscribed to GossipSub topic ${this.uri}`))
		}

		await this.libp2p.handle(this.protocol, this.streamHandler)
		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Attached stream handler for protocol ${this.protocol}`))
		}

		this.startSyncService()
		// this.startDiscoveryService()

		// const mode = await this.libp2p.dht.getMode()
		// if (mode === "server") {
		// 	this.startAnnounceService()
		// }
	}

	public get uri() {
		return `ipfs://${this.cid}`
	}

	private static protocolPrefix = `/x/canvas/sync/v2/`

	public get protocol() {
		return Source.protocolPrefix + this.cid.toString()
	}

	/**
	 * Publish a message to the GossipSub topic.
	 */
	public async publishMessage(hash: Uint8Array, data: Uint8Array) {
		if (this.options.verbose) {
			console.log(this.prefix, `Publishing message ${toHex(hash)} to GossipSub...`)
		}

		try {
			const { recipients } = await this.libp2p.pubsub.publish(this.uri, data)
			if (this.options.verbose) {
				console.log(this.prefix, `Published ${toHex(hash)} to ${recipients.length} peers.`)
			}
		} catch (err) {
			logErrorMessage(this.prefix, chalk.red(`Failed to publish ${toHex(hash)} to GossipSub`), err)
		}
	}

	/**
	 * handleGossipMessage is attached as a listener to *all* libp2p GosssipSub messages.
	 */
	private handleGossipMessage = async ({
		detail: { type, topic, data },
	}: CustomEvent<SignedMessage | UnsignedMessage>) => {
		// the first step is to check if the message is even for our topic in the first place.
		if (type !== "signed" || topic !== this.uri) {
			return
		}

		try {
			const message = JSON.parse(new TextDecoder().decode(data))
			assert(messageType.is(message), "invalid message")
			const hash = sha256(data)
			await this.messageStore.write(
				async (txn) => {
					const existingRecord = await txn.getMessage(hash)
					if (existingRecord !== null) {
						return
					}

					await this.applyMessage(txn, hash, message)
					await txn.insertMessage(hash, message)
				},
				{ uri: this.uri }
			)
		} catch (err) {
			logErrorMessage(this.prefix, chalk.red(`Error applying GossipSub message`), err)
		}
	}

	/**
	 * Handle incoming libp2p streams on the /x/canvas/sync/v2/${cid} protocol.
	 * Incoming streams are simple; we essentially just open a read-only
	 * message store transaction and respond to as many getRoot/getChildren/getMessages
	 * requests as the client needs to make.
	 */
	private streamHandler: StreamHandler = async ({ connection, stream }) => {
		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Opened incoming stream ${stream.id} from peer ${connection.remotePeer}`))
		}

		try {
			await this.messageStore.read((txn) => handleIncomingStream(this.cid, txn, stream), { uri: this.uri })
		} catch (err) {
			logErrorMessage(this.prefix, chalk.red(`Error handling incoming sync`), err)
			if (this.options.verbose) {
				console.log(this.prefix, `Aborting incoming stream ${stream.id}`)
			}

			stream.abort(err as Error)
			return
		}

		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Closed incoming stream ${stream.id}`))
		}
	}

	public schedulePeerSync(peerId: PeerId) {
		if (this.libp2p.peerId.equals(peerId)) {
			return
		}

		const id = peerId.toString()
		if (this.pendingSyncPeers.has(id)) {
			if (this.options.verbose) {
				console.log(chalk.gray(this.prefix, `[sync] Already queued sync for ${id}`))
			}

			return
		}

		if (this.syncQueue.size >= MAX_PING_QUEUE_SIZE) {
			if (this.options.verbose) {
				console.log(chalk.gray(this.prefix, `[sync] Ping queue full`))
			}

			return
		}

		const lastSyncMark = this.syncHistory.get(id)
		if (lastSyncMark !== undefined) {
			const timeSinceLastSync = performance.now() - lastSyncMark

			if (this.options.verbose) {
				console.log(chalk.gray(this.prefix, `[sync] Last sync with ${id} was ${Math.floor(timeSinceLastSync)}ms ago`))
			}

			if (timeSinceLastSync < SYNC_COOLDOWN_PERIOD) {
				return
			}
		}

		this.pendingSyncPeers.add(id)
		this.syncQueue
			.add(() => this.sync(peerId))
			.catch((err) => logErrorMessage(this.prefix, "Sync failed", err))
			.finally(() => {
				this.pendingSyncPeers.delete(id)
				this.syncHistory.set(id, performance.now())
			})
	}

	/**
	 * Initiate an MST sync with the target peer. Syncs are one-directional; we dial a
	 * peer and treat them as a server, scanning a read-only snapshot of their MST.
	 * They have to independently dial us back to access our MST.
	 */
	private async sync(peer: PeerId) {
		const prefix = chalk.magenta(`${this.prefix} [sync]`)
		console.log(prefix, `Initiating sync with ${peer}`)

		let stream: Stream
		try {
			stream = await this.dial(peer)
		} catch (err) {
			logErrorMessage(prefix, chalk.red(`Failed to dial peer ${peer}`), err)
			return
		}

		if (this.options.verbose) {
			console.log(prefix, chalk.gray(`Opened outgoing stream ${stream.id} to ${peer}`))
		}

		try {
			let successCount = 0
			let failureCount = 0

			await this.messageStore.write(async (txn) => {
				const generator = sync(this.cid, txn, stream, { verbose: this.options.verbose })
				for await (const [hash, message] of generator) {
					try {
						await this.applyMessage(txn, hash, message)
						successCount += 1
					} catch (err) {
						generator.throw(err) // this throws an exeption at the `yield` statement
						failureCount += 1
						logErrorMessage(prefix, chalk.red(`Failed to apply ${message.type} ${toHex(hash)}`), err)
					}
				}
			})

			console.log(prefix, chalk.green(`Sync with ${peer} completed.`))
			console.log(prefix, `Applied ${successCount} new messages with ${failureCount} failures.`)

			stream.close()
			if (this.options.verbose) {
				console.log(prefix, chalk.gray(`Closed outgoing stream ${stream.id}`))
			}

			this.dispatchEvent(
				new CustomEvent("sync", { detail: { peer: peer.toString(), time: Date.now(), status: "success" } })
			)
		} catch (err) {
			logErrorMessage(prefix, chalk.red(`Failed to sync with peer ${peer}`), err)

			stream.abort(err as Error)
			if (this.options.verbose) {
				console.log(prefix, `Aborted outgoing stream ${stream.id}`)
			}

			this.dispatchEvent(
				new CustomEvent("sync", { detail: { peer: peer.toString(), time: Date.now(), status: "failure" } })
			)
		}
	}

	private async dial(peerId: PeerId): Promise<Stream> {
		const prefix = `${this.prefix} [dial]`

		const existingConnections = this.libp2p.getConnections(peerId)
		if (this.options.verbose) {
			console.log(chalk.gray(prefix, `Dialing ${peerId}`))
			console.log(
				chalk.gray(prefix, `Found ${existingConnections.length} existing connections`),
				new Map(existingConnections.map(({ id, remoteAddr }) => [id, remoteAddr]))
			)
		}

		const connectionSignal = anySignal([AbortSignal.timeout(DIAL_TIMEOUT), this.controller.signal])
		const connection = await this.libp2p
			.dial(peerId, { signal: connectionSignal })
			.finally(() => connectionSignal.clear())

		try {
			const signal = anySignal([AbortSignal.timeout(DIAL_TIMEOUT), this.controller.signal])
			return await connection.newStream(this.protocol, { signal }).finally(() => signal.clear())
		} catch (err) {
			console.log(
				chalk.gray(prefix),
				chalk.yellow("Failed to open new stream, possibly due to stale relay connection.")
			)
			console.log(chalk.gray(prefix), chalk.yellow("Closing connection..."))
			await connection.close()
			await this.libp2p.hangUp(peerId)
			throw err
		}
	}

	public async handlePeerDiscovery(peerId: PeerId, addrs: Multiaddr[]) {
		const subscribers = this.libp2p.pubsub.getSubscribers(this.uri)
		if (subscribers.length < MIN_MESH_PEERS) {
			const subscriber = subscribers.find((peer) => peer.equals(peerId))
			if (subscriber === undefined) {
				if (this.options.verbose) {
					console.log(chalk.gray(this.prefix, `Dialing peer ${peerId}`))
				}

				try {
					await this.libp2p.hangUp(peerId)
					const signal = anySignal([AbortSignal.timeout(DIAL_TIMEOUT), this.controller.signal])
					await this.libp2p.dial(addrs).finally(() => signal.clear())
				} catch (err) {
					logErrorMessage(chalk.gray(this.prefix), `Failed to dial peer ${peerId}`, err)
				}
			}
		}
	}

	private async startSyncService() {
		const prefix = chalk.magenta(`[canvas-core] [${this.cid}] [sync]`)
		console.log(prefix, `Staring sync service`)

		const { signal } = this.controller
		try {
			while (!signal.aborted) {
				await wait(SYNC_COOLDOWN_PERIOD, { signal })
				for (const peer of this.libp2p.pubsub.getSubscribers(this.uri)) {
					this.schedulePeerSync(peer)
				}
			}
		} catch (err) {
			if (signal.aborted) {
				console.log(prefix, `Service aborted`)
			} else {
				logErrorMessage(prefix, chalk.red(`Service crashed`), err)
			}
		}
	}

	private async startAnnounceService() {
		const prefix = chalk.blueBright(`[canvas-core] [${this.cid}] [dht:announce]`)
		console.log(prefix, `Staring DHT announce service`)

		const { signal } = this.controller

		try {
			await wait(DHT_ANNOUNCE_DELAY, { signal })
			while (!signal.aborted) {
				await retry(
					async () => {
						console.log(prefix, `Publishing DHT provider record...`)
						const timeout = anySignal([AbortSignal.timeout(DHT_ANNOUNCE_TIMEOUT), signal])
						await this.libp2p.contentRouting.provide(this.cid, { signal: timeout }).finally(() => timeout.clear())
						console.log(prefix, chalk.green(`Successfully published DHT provider record.`))
					},
					(err) => logErrorMessage(prefix, chalk.yellow(`Failed to publish DHT provider record`), err),
					{ signal, interval: DHT_ANNOUNCE_RETRY_INTERVAL }
				)

				await wait(DHT_ANNOUNCE_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				console.log(prefix, `Service aborted`)
			} else {
				logErrorMessage(prefix, chalk.red(`Service crashed`), err)
			}
		}
	}

	private async startDiscoveryService() {
		const prefix = chalk.cyanBright(`[canvas-core] [${this.cid}] [dht:discovery]`)
		console.log(prefix, `Staring DHT discovery service`)

		const { signal } = this.controller

		try {
			await wait(DHT_DISCOVERY_DELAY, { signal })
			while (!signal.aborted) {
				await retry(
					async () => {
						const timeout = anySignal([AbortSignal.timeout(DHT_DISCOVERY_TIMEOUT), signal])
						try {
							const providers = this.libp2p.contentRouting.findProviders(this.cid, { signal: timeout })
							for await (const { id, multiaddrs } of providers) {
								console.log(prefix, `Found peer ${id} via DHT provider record`)
								await this.handlePeerDiscovery(id, multiaddrs)
							}
						} finally {
							timeout.clear()
						}
					},
					(err) => logErrorMessage(prefix, chalk.yellow(`Failed to query DHT for provider records`), err),
					{ signal, interval: DHT_DISCOVERY_RETRY_INTERVAL, maxRetries: 3 }
				)

				await wait(DHT_DISCOVERY_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				console.log(prefix, `Service aborted`)
			} else {
				logErrorMessage(prefix, chalk.red(`Service crashed`), err)
			}
		}
	}
}
