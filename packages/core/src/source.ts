import chalk from "chalk"
import PQueue from "p-queue"
import { TimeoutController } from "timeout-abort-controller"
import { sha256 } from "@noble/hashes/sha256"

import type { Libp2p } from "libp2p"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { CID } from "multiformats/cid"

import type { Message } from "@canvas-js/interfaces"
import type { MessageStore, ReadWriteTransaction } from "@canvas-js/core/components/messageStore"

import { toHex, assert, logErrorMessage } from "@canvas-js/core/utils"
import * as constants from "@canvas-js/core/constants"
import { messageType } from "@canvas-js/core/codecs"
import { sync, handleIncomingStream } from "./sync/index.js"
import { startAnnounceService } from "./services/announce.js"
import { startDiscoveryService } from "./services/discovery.js"

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
	private readonly pendingSyncPeers = new Set<string>()

	private readonly cid: CID
	private readonly messageStore: MessageStore
	private readonly libp2p: Libp2p
	private readonly applyMessage: (txn: ReadWriteTransaction, hash: Uint8Array, message: Message) => Promise<void>
	private readonly options: SourceOptions
	private readonly prefix: string

	public applicationPeers: PeerId[] = []

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
		this.libp2p.pubsub.addEventListener("message", this.handleGossipMessage)
		if (this.options.verbose) {
			console.log(this.prefix, `Subscribed to pubsub topic ${this.uri}`)
		}

		await this.libp2p.handle(this.protocol, this.streamHandler)
		if (this.options.verbose) {
			console.log(this.prefix, `Attached stream handler for protocol ${this.protocol}`)
		}

		this.libp2p.peerStore.addEventListener("change:protocols", ({ detail: { peerId, oldProtocols, protocols } }) => {
			if (this.libp2p.peerId.equals(peerId)) {
				return
			}

			const oldProtocolSet = new Set(oldProtocols)
			const newProtocolSet = new Set(protocols.filter((protocol) => !oldProtocolSet.has(protocol)))

			if (newProtocolSet.has(this.protocol)) {
				if (this.options.verbose) {
					console.log(this.prefix, `Peer ${peerId} supports Canvas protocol ${this.protocol}`)
				}

				const id = peerId.toString()
				if (this.pendingSyncPeers.has(id)) {
					return
				} else {
					this.pendingSyncPeers.add(id)
					this.syncQueue.add(async () => {
						this.pendingSyncPeers.delete(id)
						await this.sync(peerId)
					})
				}
			}
		})

		const mode = await this.libp2p.dht.getMode()
		if (mode === "server") {
			startAnnounceService(this.libp2p, this.cid, this.controller.signal)
		}

		startDiscoveryService(this.libp2p, this.cid, this.controller.signal, (peers: PeerId[]) => {
			for (const peer of peers) {
				if (this.libp2p.peerId.equals(peer)) {
					continue
				}

				const id = peer.toString()
				if (this.pendingSyncPeers.has(id)) {
					return
				}

				this.pendingSyncPeers.add(id)
				this.syncQueue.add(async () => {
					this.pendingSyncPeers.delete(id)
					await this.sync(peer)
				})
			}
		})
	}

	public async stop() {
		this.syncQueue.pause()
		this.syncQueue.clear()

		this.controller.abort()

		this.libp2p.pubsub.unsubscribe(this.uri)
		this.libp2p.pubsub.removeEventListener("message", this.handleGossipMessage)
		await this.libp2p.unhandle(this.protocol)

		if (this.options.verbose) {
			console.log(this.prefix, `Removed stream handler for protocol ${this.protocol}`)
			console.log(this.prefix, `Unsubscribed from pubsub topic ${this.uri}`)
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
			console.log(this.prefix, `Opened incoming stream ${stream.id} from peer ${connection.remotePeer}`)
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
			console.log(this.prefix, `Closed incoming stream ${stream.id}`)
		}
	}

	// private async wait(interval: number) {
	// 	await wait({ signal: this.controller.signal, interval })
	// }

	// /**
	//  * This starts the "sync service", an async while loop that looks up application peers
	//  * and calls this.sync(peerId) for each of them every constants.SYNC_INTERVAL milliseconds
	//  */
	// private async startSyncService() {
	// 	const prefix = chalk.magenta(`${this.prefix} [sync]`)
	// 	console.log(prefix, `Staring service`)

	// 	try {
	// 		await this.wait(constants.SYNC_DELAY)

	// 		while (!this.controller.signal.aborted) {
	// 			const peers = new Set<string>()
	// 			for (const peer of this.libp2p.pubsub.getSubscribers(this.uri)) {
	// 				if (peer.equals(this.libp2p.peerId)) {
	// 					continue
	// 				}

	// 				peers.add(peer.toString())
	// 			}

	// 			for await (const peer of getApplicationPeers(this.libp2p, this.cid, this.controller.signal)) {
	// 				if (peer.equals(this.libp2p.peerId)) {
	// 					continue
	// 				}

	// 				peers.add(peer.toString())
	// 			}

	// 			if (peers.size === 0) {
	// 				console.log(prefix, "No application peers found")
	// 			} else {
	// 				let i = 0
	// 				for (const peer of peers) {
	// 					console.log(prefix, `Initiating sync with ${peer} (${++i}/${peers.size})`)
	// 					await this.sync(peerIdFromString(peer))
	// 				}
	// 			}

	// 			await this.wait(constants.SYNC_INTERVAL)
	// 		}
	// 	} catch (err) {
	// 		if (err instanceof AbortError) {
	// 			console.log(prefix, `Aborting service`)
	// 		} else if (err instanceof Error) {
	// 			console.log(prefix, chalk.red(`Service crashed (${err.message})`))
	// 		} else {
	// 			throw err
	// 		}
	// 	}
	// }

	private async dial(peer: PeerId): Promise<Stream> {
		const queryController = new TimeoutController(constants.DIAL_TIMEOUT)
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		try {
			return await this.libp2p.dialProtocol(peer, this.protocol, { signal: queryController.signal })
		} finally {
			queryController.clear()
			this.controller.signal.removeEventListener("abort", abort)
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
			console.log(prefix, `Opened outgoing stream ${stream.id} to ${peer}`)
		}

		const closeStream = () => stream.close()
		this.controller.signal.addEventListener("abort", closeStream)

		let successCount = 0
		let failureCount = 0

		try {
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

			return
		} finally {
			this.controller.signal.removeEventListener("abort", closeStream)
		}

		stream.close()
		if (this.options.verbose) {
			console.log(prefix, `Closed outgoing stream ${stream.id}`)
		}
	}
}
