import assert from "node:assert"

import chalk from "chalk"
import { CID } from "multiformats/cid"
import { TimeoutController } from "timeout-abort-controller"
import { sha256 } from "@noble/hashes/sha256"

import type { Libp2p } from "libp2p"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"

import { Message } from "@canvas-js/interfaces"
import type { MessageStore } from "@canvas-js/core/components/messageStore"

import { wait, retry, AbortError, toHex, CacheMap } from "./utils.js"
import { sync, handleIncomingStream, getMessageKey } from "./sync/index.js"
import * as constants from "./constants.js"
import { metrics } from "./metrics.js"
import { messageType } from "./codecs.js"
import { MST } from "./mst.js"

interface SourceOptions {
	recentGossipPeers?: CacheMap<string, { lastSeen: number }>
	recentSyncPeers?: CacheMap<string, { lastSeen: number }>
	verbose?: boolean
}

export interface SourceConfig extends SourceOptions {
	cid: CID
	messageStore: MessageStore
	mst: MST
	libp2p: Libp2p | null
	applyMessage: (hash: Uint8Array, message: Message) => Promise<void>
}

export class Source {
	private readonly uri: string
	private readonly syncProtocol: string
	private readonly controller = new AbortController()

	public static initialize(config: SourceConfig) {
		const { cid, libp2p, messageStore, mst, applyMessage, ...options } = config
		return new Source(cid, messageStore, mst, libp2p, applyMessage, options)
	}

	private constructor(
		private readonly cid: CID,
		private readonly messageStore: MessageStore,
		private readonly mst: MST,
		private readonly libp2p: Libp2p | null,
		private readonly applyMessage: (hash: Uint8Array, message: Message) => Promise<void>,
		private readonly options: SourceOptions
	) {
		this.uri = `ipfs://${cid.toString()}`
		this.syncProtocol = `/x/canvas/sync/v1/${cid.toString()}`

		if (libp2p !== null) {
			libp2p.pubsub.subscribe(this.uri)
			libp2p.pubsub.addEventListener("message", this.handleGossipMessage)
			if (this.options.verbose) {
				console.log(`[canvas-core] [${cid}] Subscribed to pubsub topic ${this.uri}`)
			}

			libp2p.handle(this.syncProtocol, this.streamHandler)
			if (this.options.verbose) {
				console.log(`[canvas-core] [${cid}] Attached stream handler for protocol ${this.syncProtocol}`)
			}

			this.startSyncService()
			this.startAnnounceService()
		}
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null) {
			this.libp2p.unhandle(this.syncProtocol)
			this.libp2p.pubsub.unsubscribe(this.uri)
			this.libp2p.pubsub.removeEventListener("message", this.handleGossipMessage)
		}
	}

	/**
	 * Publish a message to the GossipSub topic.
	 */
	public async publishMessage(hash: Uint8Array, data: Uint8Array) {
		if (this.libp2p === null) {
			return
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] [${this.cid}] Publishing message ${toHex(hash)} to GossipSub...`)
		}

		try {
			const { recipients } = await this.libp2p.pubsub.publish(this.uri, data)
			if (this.options.verbose) {
				console.log(`[canvas-core] [${this.cid}] Published ${toHex(hash)} to ${recipients.length} peers.`)
			}
		} catch (err) {
			if (err instanceof Error) {
				console.log(
					chalk.red(`[canvas-core] [${this.cid}] Failed to publish ${toHex(hash)} to GossipSub (${err.message})`)
				)
			} else {
				throw err
			}
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
			await this.applyMessage(hash, message)
			await this.mst.write(this.uri, async (txn) => {
				txn.set(getMessageKey(hash, message), hash)
			})
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] [${this.cid}] Error applying GossipSub message (${err.message})`))
			} else {
				throw err
			}
		}
	}

	/**
	 * Handle incoming libp2p streams on the /x/canvas/sync/v1/${cid} protocol.
	 * Incoming streams are simple; we essentially just open a read-only
	 * MST transaction and respond to as many getRoot/getChildren/getMessages
	 * requests as the client needs to make.
	 */
	private streamHandler: StreamHandler = async ({ connection, stream }) => {
		if (this.options.verbose) {
			const peerId = connection.remotePeer.toString()
			console.log(`[canvas-core] [${this.cid}] Opened incoming stream ${stream.id} from peer ${peerId}`)
		}

		try {
			await this.messageStore.read(async (txn) => handleIncomingStream(stream, txn), { dbi: this.uri })
			// await this.mst.read(this.uri, async (txn) => {
			// 	await handleIncomingStream(stream, this.messageStore, txn)
			// })
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] Error handling incoming sync (${err.message})`))
				stream.abort(err)
				return
			} else {
				throw err
			}
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
		console.log(`[canvas-core] [${this.cid}] Staring announce service`)

		try {
			await this.wait(constants.ANNOUNCE_DELAY)
			while (!this.controller.signal.aborted) {
				await retry(
					() => this.announce(),
					(err) =>
						console.log(
							chalk.red(`[canvas-core] [${this.cid}] Failed to publish DHT provider record (${err.message})`)
						),
					{ signal: this.controller.signal, interval: constants.ANNOUNCE_RETRY_INTERVAL }
				)

				await this.wait(constants.ANNOUNCE_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				console.log(`[canvas-core] [${this.cid}] Aborting announce service`)
			} else if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] [${this.cid}] Announce service crashed (${err.message})`))
			} else {
				throw err
			}
		}
	}

	/**
	 * Publish a provider record to the DHT announcing us as an application peer.
	 */
	private async announce(): Promise<void> {
		assert(this.libp2p !== null)

		console.log(chalk.green(`[canvas-core] [${this.cid}] Publishing DHT provider record...`))

		const queryController = new TimeoutController(constants.ANNOUNCE_TIMEOUT)
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)
		try {
			await this.libp2p.contentRouting.provide(this.cid, { signal: queryController.signal })
			console.log(chalk.green(`[canvas-core] [${this.cid}] Successfully published DHT provider record.`))
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}
	}

	/**
	 * This starts the "sync service", an async while loop that looks up application peers
	 * and calls this.sync(peerId) for each of them every constants.SYNC_INTERVAL milliseconds
	 */
	private async startSyncService() {
		assert(this.libp2p !== null)

		console.log(`[canvas-core] [${this.cid}] Staring sync service`)

		try {
			await this.wait(constants.SYNC_DELAY)

			while (!this.controller.signal.aborted) {
				const subscribers = this.libp2p.pubsub.getSubscribers(this.uri)

				metrics.canvas_gossipsub_subscribers.set({ uri: this.uri }, subscribers.length)
				if (this.options.recentGossipPeers) {
					for (const peer of subscribers) {
						this.options.recentGossipPeers.set(peer.toString(), { lastSeen: Date.now() })
					}
				}

				const peers = await retry(
					() => this.findSyncPeers(),
					(err) =>
						console.log(chalk.red(`[canvas-core] [${this.cid}] Failed to locate application peers (${err.message})`)),
					{ signal: this.controller.signal, interval: constants.SYNC_RETRY_INTERVAL }
				)

				metrics.canvas_sync_peers.set({ uri: this.uri }, peers.length)

				console.log(chalk.green(`[canvas-core] [${this.cid}] Found ${peers.length} application peers.`))

				for (const [i, peer] of peers.entries()) {
					console.log(
						chalk.green(
							`[canvas-core] [${this.cid}] Initiating sync with ${peer.toString()} (${i + 1}/${peers.length})`
						)
					)

					await this.sync(peer)
				}

				await this.wait(constants.SYNC_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				console.log(`[canvas-core] [${this.cid}] Aborting sync service`)
			} else if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] [${this.cid}] Sync service crashed (${err.message})`))
			} else {
				throw err
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

		console.log(`[canvas-core] [${this.cid}] Querying DHT for application peers...`)

		const queryController = new TimeoutController(constants.FIND_PEERS_TIMEOUT)
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		try {
			const peers: PeerId[] = []
			for await (const { id } of this.libp2p.contentRouting.findProviders(this.cid, {
				signal: queryController.signal,
			})) {
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

		const queryController = new TimeoutController(constants.DIAL_PEER_TIMEOUT)
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		let stream: Stream
		try {
			stream = await this.libp2p.dialProtocol(peer, this.syncProtocol, { signal: queryController.signal })
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] [${this.cid}] Failed to dial peer ${peer.toString()} (${err.message})`))
				return
			} else {
				throw err
			}
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}

		const closeStream = () => stream.close()
		this.controller.signal.addEventListener("abort", closeStream)

		if (this.options.verbose) {
			console.log(`[canvas-core] [${this.cid}] Opened outgoing stream ${stream.id} to ${peer.toString()}`)
		}

		// wait until we've successfully dialed the peer before update its lastSeen
		this.options.recentSyncPeers?.set(peer.toString(), { lastSeen: Date.now() })

		let successCount = 0
		let failureCount = 0

		// this is the callback passed to `sync`, invoked with each missing message identified during MST sync.
		// if handleSyncMessage succeeds, then sync() will automatically insert the message into the MST.
		const handleSyncMessage = async (hash: Uint8Array, data: Uint8Array, message: Message) => {
			const id = toHex(hash)
			if (this.options.verbose) {
				console.log(chalk.green(`[canvas-core] [${this.cid}] Received missing ${message.type} ${id}`))
			}

			try {
				await this.applyMessage(hash, message)
				successCount += 1
			} catch (err) {
				if (err instanceof Error) {
					console.log(chalk.red(`[canvas-core] [${this.cid}] Failed to apply ${message.type} ${id} (${err.message})`))
					failureCount += 1
				} else {
					throw err
				}
			}

			try {
				await this.publishMessage(hash, data)
			} catch (err) {
				if (err instanceof Error) {
					console.log(
						chalk.red(
							`[canvas-core] [${this.cid}] Failed to publish ${message.type} ${id} to GossipSub (${err.message})`
						)
					)
				} else {
					throw err
				}
			}
		}

		// unclear if it's better to have the timer inside the txn or outside it
		const timer = metrics.canvas_sync_time.startTimer()
		try {
			await this.messageStore.write(async (txn) => {
				if (this.options.verbose) {
					const { hash: oldRoot } = await txn.getRoot()
					console.log(`[canvas-core] [${this.cid}] The old merkle root is ${toHex(oldRoot)}`)
				}

				await sync(stream, txn, handleSyncMessage)

				if (this.options.verbose) {
					const { hash: newRoot } = await txn.getRoot()
					console.log(`[canvas-core] [${this.cid}] The new merkle root is ${toHex(newRoot)}`)
				}

				console.log(
					chalk.green(
						`[canvas-core] [${this.cid}] Sync with ${peer} completed. Applied ${successCount} new messages with ${failureCount} failures.`
					)
				)

				timer({ uri: this.uri, status: "success" })
			})
			// await this.mst.write(this.uri, async (txn) => {
			// 	if (this.options.verbose) {
			// 		const { hash: oldRoot } = txn.getRoot()
			// 		console.log(`[canvas-core] [${this.cid}] The old merkle root is ${toHex(oldRoot)}`)
			// 	}

			// 	await sync(this.messageStore, txn, stream, handleSyncMessage)

			// 	if (this.options.verbose) {
			// 		const { hash: newRoot } = txn.getRoot()
			// 		console.log(`[canvas-core] [${this.cid}] The new merkle root is ${toHex(newRoot)}`)
			// 	}

			// 	console.log(
			// 		chalk.green(
			// 			`[canvas-core] [${this.cid}] Sync with ${peer} completed. Applied ${successCount} new messages with ${failureCount} failures.`
			// 		)
			// 	)

			// 	timer({ uri: this.uri, status: "success" })
			// })
		} catch (err) {
			timer({ uri: this.uri, status: "failure" })
			if (err instanceof Error) {
				console.log(chalk.red(`[canvas-core] [${this.cid}] Failed to sync with peer ${peer} (${err.message})`))
				stream.abort(err)
				return
			} else {
				throw err
			}
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] [${this.cid}] Closing outgoing stream ${stream.id}`)
		}

		stream.close()
	}
}
