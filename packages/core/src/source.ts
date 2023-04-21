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

import type { Message } from "@canvas-js/interfaces"
import type { MessageStore, ReadWriteTransaction } from "@canvas-js/core/components/messageStore"

import { DIAL_TIMEOUT, SYNC_COOLDOWN_PERIOD } from "@canvas-js/core/constants"
import { messageType } from "@canvas-js/core/codecs"
import { toHex, assert, logErrorMessage, CacheMap } from "@canvas-js/core/utils"
import { sync, handleIncomingStream } from "@canvas-js/core/sync"
// import { startAnnounceService } from "./services/announce.js"
// import { startDiscoveryService } from "./services/discovery.js"

export interface SourceOptions {
	verbose?: boolean
}

export interface SourceConfig extends SourceOptions {
	cid: CID
	messageStore: MessageStore
	libp2p: Libp2p
	applyMessage: (txn: ReadWriteTransaction, hash: Uint8Array, message: Message) => Promise<void>
}

interface SourceEvents {
	sync: CustomEvent<{ peer: string; time: number; status: "success" | "failure" }>
}

export class Source extends EventEmitter<SourceEvents> {
	private readonly controller = new AbortController()
	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly pendingSyncPeers = new Map<string, {}>()
	private readonly syncHistroy = new CacheMap<string, number>(20)

	private readonly cid: CID
	private readonly messageStore: MessageStore
	private readonly libp2p: Libp2p
	private readonly applyMessage: (txn: ReadWriteTransaction, hash: Uint8Array, message: Message) => Promise<void>
	private readonly options: SourceOptions
	private readonly prefix: string

	public constructor(config: SourceConfig) {
		super()
		const { cid, libp2p, messageStore, applyMessage, ...options } = config
		this.cid = cid
		this.libp2p = libp2p
		this.messageStore = messageStore
		this.applyMessage = applyMessage
		this.options = options
		this.prefix = `[canvas-core] [${this.cid}]`
	}

	public async start() {
		this.libp2p.pubsub.subscribe(this.uri)
		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Subscribed to GossipSub topic`))
		}

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

				this.handlePeerDiscovery(peerId)
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
					console.log(chalk.blueBright(this.prefix, `Peer ${peerId} joined the GossipSub topic`))
				}

				this.handlePeerDiscovery(peerId)
			} else {
				if (this.options.verbose) {
					console.log(chalk.blueBright(this.prefix, `Peer ${peerId} left the GossipSub topic`))
				}
			}
		})

		await this.libp2p.handle(this.protocol, this.streamHandler)
		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Attached stream handler for protocol ${this.protocol}`))
		}

		// const mode = await this.libp2p.dht.getMode()
		// if (mode === "server") {
		// 	startAnnounceService({ libp2p: this.libp2p, cid: this.cid, signal: this.controller.signal })
		// }

		// startDiscoveryService({
		// 	libp2p: this.libp2p,
		// 	cid: this.cid,
		// 	topic: this.uri,
		// 	signal: this.controller.signal,
		// 	callback: (peerId) => this.handlePeerDiscovery(peerId),
		// })
	}

	public async stop() {
		this.syncQueue.pause()
		this.syncQueue.clear()

		this.controller.abort()

		this.libp2p.pubsub.unsubscribe(this.uri)
		this.libp2p.pubsub.removeEventListener("message", this.handleGossipMessage)
		await this.libp2p.unhandle(this.protocol)

		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Removed stream handler for protocol ${this.protocol}`))
			console.log(chalk.gray(this.prefix, `Unsubscribed from GossipSub topic`))
		}
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

	private async handlePeerDiscovery(peerId: PeerId) {
		const id = peerId.toString()
		if (this.pendingSyncPeers.has(id)) {
			return
		}

		const lastSyncMark = this.syncHistroy.get(id)
		const now = performance.now()
		if (lastSyncMark !== undefined && now - lastSyncMark < SYNC_COOLDOWN_PERIOD) {
			return
		}

		this.pendingSyncPeers.set(id, {})
		try {
			await this.syncQueue.add(() => this.sync(peerId))
		} catch (err) {
			logErrorMessage(this.prefix, "Sync failed", err)
		} finally {
			this.pendingSyncPeers.delete(id)
			this.syncHistroy.set(id, performance.now())
		}
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
			console.log(chalk.gray(this.prefix, `Opened outgoing stream ${stream.id} to ${peer}`))
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
				console.log(chalk.gray(this.prefix, `Closed outgoing stream ${stream.id}`))
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
		if (this.options.verbose) {
			console.log(chalk.gray(this.prefix, `Dialing ${peerId}`))
		}

		const signal = anySignal([AbortSignal.timeout(DIAL_TIMEOUT), this.controller.signal])

		try {
			const connection = await this.libp2p.dial(peerId, { signal })
			try {
				const stream = await connection.newStream(this.protocol, { signal })
				return stream
			} catch (err) {
				if (err instanceof Error && !signal.aborted) {
					console.log(this.prefix, chalk.yellow("Failed to open new stream, possibly due to stale relay connection."))
					console.log(this.prefix, chalk.yellow("Closing connection and attempting to re-dial..."))
					await connection.close()
					await this.libp2p.hangUp(peerId)
					return await this.libp2p.dialProtocol(peerId, this.protocol, { signal })
				} else {
					throw err
				}
			}
		} finally {
			signal.clear()
		}
	}
}
