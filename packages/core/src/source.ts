import chalk from "chalk"
import { CID } from "multiformats/cid"
import { TimeoutController } from "timeout-abort-controller"
import { sha256 } from "@noble/hashes/sha256"

import type { Libp2p } from "libp2p"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"

import type { Message } from "@canvas-js/interfaces"
import type { MessageStore, ReadWriteTransaction } from "@canvas-js/core/components/messageStore"

import { wait, retry, AbortError, toHex, assert } from "@canvas-js/core/utils"
import * as constants from "@canvas-js/core/constants"
import { messageType } from "@canvas-js/core/codecs"
import { sync, handleIncomingStream } from "./sync/index.js"

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

		this.startSyncService()
		this.startDiscoveryService()

		const mode = await this.libp2p.dht.getMode()
		if (mode === "server") {
			this.startAnnounceService()
		}
	}

	public async stop() {
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

	public get protocol() {
		return `/x/canvas/sync/v2/${this.cid}`
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
			if (err instanceof Error) {
				console.log(chalk.red(this.prefix, `Failed to publish ${toHex(hash)} to GossipSub (${err.message})`))
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
			await this.messageStore.write(
				async (txn) => {
					const existingRecord = await txn.getMessage(hash)
					if (existingRecord !== null) {
						return
					}

					await this.applyMessage(txn, hash, message)
					await txn.insertMessage(hash, message)
				},
				{ dbi: this.uri }
			)
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(this.prefix, `Error applying GossipSub message (${err.message})`))
			} else {
				throw err
			}
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
			await this.messageStore.read((txn) => handleIncomingStream(this.cid, txn, stream), { dbi: this.uri })
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(this.prefix, `Error handling incoming sync (${err.message})`))
				if (this.options.verbose) {
					console.log(this.prefix, `Aborting incoming stream ${stream.id}`)
				}

				stream.abort(err)
				return
			} else {
				throw err
			}
		}

		if (this.options.verbose) {
			console.log(this.prefix, `Closed incoming stream ${stream.id}`)
		}
	}

	private async wait(interval: number) {
		await wait({ signal: this.controller.signal, interval })
	}

	/**
	 * This starts the "discovery service", an async while loop that calls this.discover()
	 * every constants.ANNOUNCE_INTERVAL milliseconds
	 */
	private async startDiscoveryService() {
		const prefix = `${this.prefix} [discovery]`
		console.log(prefix, `Staring discovery service`)

		try {
			await this.wait(constants.DISCOVERY_DELAY)
			while (!this.controller.signal.aborted) {
				await retry(
					() => this.discover(),
					(err) => console.log(chalk.yellow(prefix, `Failed to query DHT for provider records (${err.message})`)),
					{ signal: this.controller.signal, interval: constants.DISCOVERY_RETRY_INTERVAL }
				)

				await this.wait(constants.DISCOVERY_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError || this.controller.signal.aborted) {
				console.log(prefix, `Aborting service`)
			} else if (err instanceof Error) {
				console.log(chalk.red(prefix, `Service crashed (${err.message})`))
			} else {
				throw err
			}
		}
	}

	private async discover(): Promise<void> {
		const prefix = `${this.prefix} [discovery]`
		console.log(prefix, `Querying DHT for provider records...`)

		const queryController = new TimeoutController(constants.DISCOVERY_TIMEOUT)
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		const queryOptions = { signal: queryController.signal }

		try {
			const peers: PeerId[] = []
			for await (const { id } of this.libp2p.contentRouting.findProviders(this.cid, queryOptions)) {
				if (this.options.verbose) {
					console.log(prefix, `Found application peer ${id}`)
				}

				peers.push(id)
			}

			// TODO: is there anything we should actually do with these?
			this.applicationPeers = peers
		} finally {
			queryController.clear()
			this.controller.signal.removeEventListener("abort", abort)
		}
	}

	/**
	 * This starts the "announce service", an async while loop that calls this.announce()
	 * every constants.ANNOUNCE_INTERVAL milliseconds
	 */
	private async startAnnounceService() {
		const prefix = `${this.prefix} [announce]`
		console.log(prefix, `Staring service`)

		try {
			await this.wait(constants.ANNOUNCE_DELAY)
			while (!this.controller.signal.aborted) {
				await retry(
					() => this.announce(),
					(err) => console.log(chalk.yellow(prefix, `Failed to publish DHT provider record (${err.message})`)),
					{ signal: this.controller.signal, interval: constants.ANNOUNCE_RETRY_INTERVAL }
				)

				await this.wait(constants.ANNOUNCE_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				console.log(prefix, `Aborting service`)
			} else if (err instanceof Error) {
				console.log(chalk.red(prefix, `Service crashed (${err.message})`))
			} else {
				throw err
			}
		}
	}

	/**
	 * Publish a provider record to the DHT announcing us as an application peer.
	 */
	private async announce(): Promise<void> {
		const prefix = `${this.prefix} [announce]`
		console.log(chalk.green(prefix, `Publishing DHT provider record...`))

		const queryController = new TimeoutController(constants.ANNOUNCE_TIMEOUT)
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)
		try {
			await this.libp2p.contentRouting.provide(this.cid, { signal: queryController.signal })
			console.log(chalk.green(prefix, `Successfully published DHT provider record.`))
		} finally {
			queryController.clear()
			this.controller.signal.removeEventListener("abort", abort)
		}
	}

	/**
	 * This starts the "sync service", an async while loop that looks up application peers
	 * and calls this.sync(peerId) for each of them every constants.SYNC_INTERVAL milliseconds
	 */
	private async startSyncService() {
		const prefix = `${this.prefix} [sync]`
		console.log(prefix, `Staring service`)

		try {
			await this.wait(constants.SYNC_DELAY)

			while (!this.controller.signal.aborted) {
				const peers = this.libp2p.pubsub.getSubscribers(this.uri)

				for (const [i, peer] of peers.entries()) {
					console.log(chalk.green(prefix, `Initiating sync with ${peer} (${i + 1}/${peers.length})`))

					await this.sync(peer)
				}

				await this.wait(constants.SYNC_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				console.log(prefix, `Aborting service`)
			} else if (err instanceof Error) {
				console.log(chalk.red(prefix, `Service crashed (${err.message})`))
			} else {
				throw err
			}
		}
	}

	private async dial(peer: PeerId): Promise<Stream> {
		const queryController = new TimeoutController(constants.DIAL_PEER_TIMEOUT)
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
		const prefix = `${this.prefix} [sync]`

		let stream: Stream
		try {
			stream = await this.dial(peer)
		} catch (err) {
			if (err instanceof Error) {
				console.log(chalk.red(prefix, `Failed to dial peer ${peer} (${err.message})`))
				return
			} else {
				throw err
			}
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
						if (err instanceof Error) {
							generator.throw(err) // this throws an exeption at the `yield` statement
							failureCount += 1
							console.log(chalk.red(prefix, `Failed to apply ${message.type} ${toHex(hash)} (${err.message})`))
						} else {
							throw err
						}
					}
				}
			})

			console.log(
				chalk.green(
					prefix,
					`Sync with ${peer} completed. Applied ${successCount} new messages with ${failureCount} failures.`
				)
			)

			this.dispatchEvent(
				new CustomEvent("sync", { detail: { peer: peer.toString(), time: Date.now(), status: "success" } })
			)
		} catch (err) {
			if (err instanceof Error) {
				this.dispatchEvent(
					new CustomEvent("sync", { detail: { peer: peer.toString(), time: Date.now(), status: "failure" } })
				)

				console.log(chalk.red(prefix, `Failed to sync with peer ${peer} (${err.message})`))
				stream.abort(err)
				if (this.options.verbose) {
					console.log(prefix, `Aborted outgoing stream ${stream.id}`)
				}

				return
			} else {
				throw err
			}
		} finally {
			this.controller.signal.removeEventListener("abort", closeStream)
		}

		stream.close()

		if (this.options.verbose) {
			console.log(prefix, `Closed outgoing stream ${stream.id}`)
		}
	}
}
