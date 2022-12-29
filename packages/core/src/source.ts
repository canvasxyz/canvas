import assert from "node:assert"
import { createHash } from "node:crypto"

import chalk from "chalk"
import { CID } from "multiformats/cid"

import { Libp2p } from "libp2p"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"

import * as okra from "node-okra"

import { wait, retry, AbortError, toHex, signalInvalidType } from "./utils.js"
import { BinaryAction, BinaryMessage, BinarySession, decodeBinaryMessage } from "./encoding.js"
import { sync, handleIncomingStream } from "./rpc/index.js"
import * as constants from "./constants.js"

// We declare this interface to enforce that Source only has read access to the message store.
// All the writes still happen in Core.
interface MessageStore {
	getSessionByHash(hash: Buffer): BinarySession | null
	getActionByHash(hash: Buffer): BinaryAction | null
}

export interface SourceOptions {
	verbose?: boolean
	offline?: boolean
}

export interface SourceConfig extends SourceOptions {
	path: string
	cid: CID
	applyMessage: (hash: Buffer, message: BinaryMessage) => Promise<void>
	messageStore: MessageStore
	libp2p: Libp2p | null
}

export class Source {
	public readonly mst: okra.Tree

	private readonly uri: string
	private readonly syncProtocol: string
	private readonly controller = new AbortController()

	public static initialize(config: SourceConfig) {
		const { path, cid, libp2p, applyMessage, messageStore, ...options } = config
		return new Source(path, cid, applyMessage, messageStore, libp2p, options)
	}

	private constructor(
		path: string,
		private readonly cid: CID,
		private readonly applyMessage: (hash: Buffer, message: BinaryMessage) => Promise<void>,
		private readonly messageStore: MessageStore,
		private readonly libp2p: Libp2p | null,
		private readonly options: SourceOptions
	) {
		this.uri = `ipfs://${cid.toString()}`
		this.syncProtocol = `/x/canvas/sync/${cid.toString()}`

		this.mst = new okra.Tree(path)

		if (libp2p !== null && !this.options.offline) {
			libp2p.pubsub.subscribe(this.uri)
			libp2p.pubsub.addEventListener("message", this.handleMessage)
			if (this.options.verbose) {
				console.log(`[canvas-core] Subscribed to pubsub topic ${this.uri}.`)
			}

			libp2p.handle(this.syncProtocol, this.streamHandler)
			this.startSyncService()
			this.startAnnounceService()
		}
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null && !this.options.offline) {
			this.libp2p.unhandle(this.syncProtocol)
			this.libp2p.pubsub.unsubscribe(this.uri)
			this.libp2p.pubsub.removeEventListener("message", this.handleMessage)
		}

		this.mst.close()
	}

	/**
	 * Insert the message into the MST.
	 * This is synchronous and internally opens a locking write transaction.
	 */
	public insertMessage(hash: Buffer, message: BinaryMessage) {
		const leaf = Buffer.alloc(14)
		if (message.type === "action") {
			leaf.writeUintBE(message.payload.timestamp * 2 + 1, 0, 6)
		} else if (message.type === "session") {
			leaf.writeUintBE(message.payload.timestamp * 2, 0, 6)
		} else {
			signalInvalidType(message)
		}

		hash.copy(leaf, 6, 0, 8)
		this.mst.insert(leaf, hash)
	}

	/**
	 * Publish a message to the GossipSub topic.
	 */
	public async publishMessage(hash: Buffer, data: Uint8Array) {
		if (this.libp2p === null || this.options.offline) {
			return
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Publishing message ${toHex(hash)} to GossipSub...`)
		}

		await this.libp2p.pubsub
			.publish(this.uri, data)
			.then(({ recipients }) => {
				if (this.options.verbose) {
					console.log(`[canvas-core] Published ${toHex(hash)} to ${recipients.length} peers.`)
				}
			})
			.catch((err) => {
				console.log(chalk.red(`[canvas-core] Failed to publish ${toHex(hash)} to GossipSub.`), err)
			})
	}

	/**
	 * handleMessage is attached as a listener to *all* libp2p GosssipSub messages
	 */
	private handleMessage = async ({ detail: message }: CustomEvent<SignedMessage | UnsignedMessage>) => {
		// the first step is to check if the message is even for our topic in the first place.
		if (message.type !== "signed" || message.topic !== this.uri) {
			return
		}

		try {
			const binaryMessage = decodeBinaryMessage(message.data)
			const hash = createHash("sha256").update(message.data).digest()
			await this.applyMessage(hash, binaryMessage)
			this.insertMessage(hash, binaryMessage)
		} catch (err) {
			console.log(chalk.red("[canvas-core] Error applying GossipSub message."), err)
		}
	}

	/**
	 * Handle incoming libp2p streams on the /x/canvas/sync/${cid} protocol.
	 * Incoming streams are simple; we essentially just open a read-only
	 * MST transaction and respond to as many getChildren requests as the
	 * client needs to make.
	 */
	private streamHandler: StreamHandler = async ({ connection, stream }) => {
		if (this.options.verbose) {
			const peerId = connection.remotePeer.toString()
			console.log(`[canvas-core] Opened incoming stream ${stream.id} from peer ${peerId}.`)
		}

		await handleIncomingStream(stream, this.messageStore, this.mst)
		if (this.options.verbose) {
			console.log(`[canvas-core] Closed incoming stream ${stream.id}.`)
		}
	}

	private async wait(interval: number) {
		await wait({ signal: this.controller.signal, interval })
	}

	/**
	 * This starts the "announce service", an async while loop that calls this.announce()
	 * every constants.ANNOUNCE_INTERVAL milliseconds
	 */
	private async startAnnounceService() {
		if (this.options.verbose) {
			console.log("[canvas-core] Staring announce service.")
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		try {
			await this.wait(constants.ANNOUNCE_DELAY)
			while (!queryController.signal.aborted) {
				await retry(
					() => this.announce(),
					(err) => console.log(chalk.red("[canvas-core] Failed to publish DHT provider record."), err.message),
					{ signal: queryController.signal, interval: constants.ANNOUNCE_RETRY_INTERVAL }
				)
				await this.wait(constants.ANNOUNCE_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				if (this.options.verbose) {
					console.log(`[canvas-core] Aborting announce service.`)
				}
			} else {
				console.log(chalk.red(`[canvas-core] Announce service crashed.`))
				console.log(err)
			}
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
			queryController.abort()
		}
	}

	/**
	 * Publish a provider record to the DHT announcing us as an application peer.
	 */
	private async announce(): Promise<void> {
		assert(this.libp2p !== null)
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Publishing DHT provider record ${this.cid.toString()}...`))
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)
		try {
			await this.libp2p.contentRouting.provide(this.cid, { signal: queryController.signal })
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}

		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Successfully published DHT provider record.`))
		}
	}

	/**
	 * This starts the "sync service", an async while loop that looks up application peers
	 * and calls this.sync(peerId) for each of them every constants.SYNC_INTERVAL milliseconds
	 */
	private async startSyncService() {
		if (this.options.verbose) {
			console.log("[canvas-core] Staring sync service.")
		}

		try {
			await this.wait(constants.SYNC_DELAY)
			while (!this.controller.signal.aborted) {
				const peers = await retry(
					() => this.findSyncPeers(),
					(err) => console.log(chalk.red(`[canvas-core] Failed to locate application peers.`), err.message),
					{ signal: this.controller.signal, interval: constants.SYNC_RETRY_INTERVAL }
				)

				if (this.options.verbose) {
					console.log(chalk.green(`[canvas-core] Found ${peers.length} peers for ${this.uri}.`))
				}

				for (const [i, peer] of peers.entries()) {
					if (this.options.verbose) {
						console.log(
							chalk.green(`[canvas-core] Initiating sync with ${peer.toString()}. (${i + 1}/${peers.length})`)
						)
					}

					await this.sync(peer)
				}

				await this.wait(constants.SYNC_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				if (this.options.verbose) {
					console.log("[canvas-core] Aborting sync service.")
				}
			} else {
				console.log(chalk.red(`[canvas-core] Sync service crashed.`))
				console.log(err)
			}
		}
	}

	/**
	 * Locates application peers to sync with.
	 * There are two ways we could do this: using the DHT with a findProviders query,
	 * or using the current set of direct GossipSub peers. Right now we use the DHT
	 * method, which has the added benefit of exposing the GossipSub component to additional
	 * peers it might not have seen yet.
	 */
	private async findSyncPeers(): Promise<PeerId[]> {
		assert(this.libp2p !== null)

		if (this.options.verbose) {
			console.log("[canvas-core] Querying DHT for application peers...")
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		const { contentRouting } = this.libp2p
		try {
			const peers: PeerId[] = []
			for await (const { id } of contentRouting.findProviders(this.cid, { signal: queryController.signal })) {
				if (id.equals(this.libp2p.peerId)) {
					continue
				} else {
					peers.push(id)
				}
			}

			return peers
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}
	}

	/**
	 * Initiate an MST sync with the target peer. Syncs are one-directional; we dial a
	 * peer and treat them as a server, scanning a read-only snapshot of their MST.
	 * They have to independently dial us back to access our MST.
	 */
	private async sync(peer: PeerId) {
		assert(this.libp2p !== null)

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		let stream: Stream
		try {
			stream = await this.libp2p.dialProtocol(peer, this.syncProtocol, { signal: queryController.signal })
		} catch (err: any) {
			// show all errors, if we receive an AggregateError
			console.log(chalk.red(`[canvas-core] Failed to dial peer ${peer.toString()}.`, err.errors ?? err))
			return
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Opened outgoing stream ${stream.id} to ${peer.toString()}.`)
		}

		const closeStream = () => stream.close()
		this.controller.signal.addEventListener("abort", closeStream)

		let successCount = 0
		let failureCount = 0

		// this is the callback passed to `sync`, invoked per MST sync message
		const handleMessage = async (hash: Buffer, data: Uint8Array, message: BinaryMessage) => {
			const id = toHex(hash)
			if (this.options.verbose) {
				console.log(chalk.green(`[canvas-core] Received missing ${message.type} ${id}.`))
			}

			try {
				await this.applyMessage(hash, message)
				this.insertMessage(hash, message)
				await this.publishMessage(hash, data)
				successCount += 1
			} catch (err) {
				console.log(chalk.red(`[canvas-core] Failed to apply message ${id}.`), err)
				failureCount += 1
			}
		}

		try {
			await sync(this.mst, stream, handleMessage)
		} catch (err) {
			console.log(chalk.red(`[canvas-core] Failed to sync with peer ${peer.toString()}.`), err)
		} finally {
			this.controller.signal.removeEventListener("abort", closeStream)
		}

		console.log(
			`[canvas-core] Sync with ${peer.toString()} completed. Applied ${successCount} new messages with ${failureCount} failures.`
		)

		if (this.options.verbose) {
			console.log(`[canvas-core] Closed outgoing stream ${stream.id}.`)
		}
	}
}
