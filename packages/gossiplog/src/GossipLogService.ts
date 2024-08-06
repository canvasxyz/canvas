import {
	PeerId,
	TopicValidatorResult,
	Logger,
	Connection,
	Stream,
	StreamHandler,
	CodeError,
	Libp2p,
} from "@libp2p/interface"

import { GossipSub, GossipsubEvents, multicodec as GossipsubIDv11 } from "@chainsafe/libp2p-gossipsub"
import { logger } from "@libp2p/logger"
import { peerIdFromString } from "@libp2p/peer-id"

import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { Pushable, pushable } from "it-pushable"
import { equals } from "uint8arrays"
import { Uint8ArrayList } from "uint8arraylist"
import { anySignal } from "any-signal"
import PQueue from "p-queue"

import { assert, DelayableController } from "@canvas-js/utils"

import { Event } from "#protocols/events"

import {
	DEFAULT_PROTOCOL_SELECT_TIMEOUT,
	MAX_INBOUND_STREAMS,
	MAX_OUTBOUND_STREAMS,
	NEGOTIATE_FULLY,
	SYNC_RETRY_INTERVAL,
	SYNC_RETRY_LIMIT,
	SYNC_TIMEOUT,
} from "./constants.js"

import { AbstractGossipLog } from "./AbstractGossipLog.js"

import { decodeId, encodeId } from "./ids.js"
import { Client, decodeRequests, encodeResponses } from "./sync/index.js"

import { MISSING_PARENT, SyncTimeoutError, wait } from "./utils.js"
import { Server } from "./sync/server.js"

import { SignedMessage } from "./SignedMessage.js"
import { ServiceMap } from "./interface.js"

export const getSyncProtocol = (topic: string) => `/canvas/v1/${topic}/sync`
export const getPushProtocol = (topic: string) => `/canvas/v1/${topic}/push`

export interface GossipLogServiceInit {
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export class GossipLogService<Payload = unknown> {
	private static extractGossipSub(libp2p: Libp2p<ServiceMap>): GossipSub | null {
		try {
			const pubsub = libp2p.services.pubsub
			assert(pubsub instanceof GossipSub, "expected pubsub instanceof GossipSub")
			return pubsub
		} catch (err) {
			return null
		}
	}

	public readonly syncProtocol = getSyncProtocol(this.messageLog.topic)
	public readonly pushProtocol = getPushProtocol(this.messageLog.topic)

	private readonly log: Logger
	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number
	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()

	private readonly controller = new AbortController()
	private readonly pushTopology = new Set<string>()
	private readonly litePeers = new Set<string>()

	#pushTopologyId: string | null = null
	#pubsub: GossipSub | null = null
	#started = false

	#pushStreams = new Map<string, { stream: Stream; source: Pushable<Uint8Array, void, unknown> }>()

	constructor(
		public readonly libp2p: Libp2p<ServiceMap>,
		public readonly messageLog: AbstractGossipLog<Payload>,
		init: GossipLogServiceInit,
	) {
		this.log = logger(`canvas:gossiplog:[${this.messageLog.topic}]:service`)
		this.#pubsub = GossipLogService.extractGossipSub(libp2p)

		this.maxInboundStreams = init.maxInboundStreams ?? MAX_INBOUND_STREAMS
		this.maxOutboundStreams = init.maxOutboundStreams ?? MAX_OUTBOUND_STREAMS
	}

	public async start() {
		this.log("start")
		if (this.#started === true) return
		this.#started = true

		this.libp2p.addEventListener("connection:open", this.handleConnectionOpen)
		this.libp2p.addEventListener("connection:close", this.handleConnectionClose)
		this.#pubsub?.addEventListener("gossipsub:message", this.handleMessage)

		/**
		 * sync is the protocol for initiating merkle syncs using the Okra index.
		 * syncs are initiated in three cases:
		 * 1. when a peer receives an orphan message via gossipsub, it schedules
		 *    a sync with the gossipsub message's "propagation source"
		 * 2. when a peer receives a push update with missing heads, it schedules
		 *    a sync with the sender
		 * 3. when a peer receives a push insert with missing parents, it schedules
		 *    a sync with the sender
		 */
		await this.libp2p.handle(this.syncProtocol, this.handleIncomingSync, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		/**
     * push is the protocol for sending Update and Insert events to specific peers.
     * - Update events carry the sender's set of latest concurrent message ids ("heads")
     * - Insert events carry a signed message as an encoded [key, value] entry
     * Updates are pushed in two cases:
     * 1. once for every new connection, so that the recipient can merkle sync
     *    back if necessary. this happens from both sides of each connection simultaneously.
     * 2. whenever a peer finishes an merkle sync during which it received one or more
     *    missing messages, it pushes its new heads to all of its peers, except for
     *    the sync source.
     * Inserts are used for interacting with "lite client" peers, identified by the lack of
     * support for the gossipsub protocol.
     * - lite clients always push every new append directly to all of their peers.
     * - full clients forward every gossipsub message to all of their lite client peers.
     * - full clients forward every insert push to all of their lite client peers, except
         for the push sender.
     */
		await this.libp2p.handle(this.pushProtocol, this.handleIncomingPush, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		this.#pushTopologyId = await this.libp2p.register(this.pushProtocol, {
			notifyOnTransient: false,
			onConnect: (peerId, connection) => {
				this.log("connected to %p", peerId)
				this.pushTopology.add(peerId.toString())

				const protocolSelectSignal = AbortSignal.timeout(DEFAULT_PROTOCOL_SELECT_TIMEOUT)
				connection.newStream(this.pushProtocol, { negotiateFully: NEGOTIATE_FULLY, signal: protocolSelectSignal }).then(
					(stream) => {
						const peerId = connection.remotePeer
						this.log("opened outgoing push stream %s to peer %p", stream.id, peerId)

						const source = pushable()
						this.#pushStreams.set(peerId.toString(), { stream, source })
						Promise.all([
							// outgoing events
							pipe(source, lp.encode, stream.sink),
							// incoming events
							pipe(stream.source, lp.decode, this.getPushSink(connection, stream)),
						]).finally(() => this.log("closed outgoing push stream %s from peer %p", stream.id, peerId))

						this.messageLog.getClock().then(([_, heads]) => {
							this.#push(peerId.toString(), Event.encode({ update: { heads: heads.map(encodeId) } }))
						})
					},
					(err) => {
						this.log.error("failed to open outgoing push stream: %O", err)
						throw err
					},
				)

				this.libp2p.peerStore.get(peerId).then((peer) => {
					if (!peer.protocols.includes(GossipsubIDv11)) {
						this.litePeers.add(peerId.toString())
					}
				})
			},

			onDisconnect: (peerId) => {
				this.log("disconnected %p", peerId)
				this.pushTopology.delete(peerId.toString())
				this.litePeers.delete(peerId.toString())

				const { source, stream } = this.#pushStreams.get(peerId.toString()) ?? {}
				if (source !== undefined && stream !== undefined) {
					this.#pushStreams.delete(peerId.toString())
					source.end()
					stream.close()
				}
			},
		})

		this.#pubsub?.subscribe(this.messageLog.topic)
	}

	private handleConnectionOpen = ({ detail: connection }: CustomEvent<Connection>) => {
		this.log("connection:open %s %p", connection.id, connection.remotePeer)
	}

	private handleConnectionClose = ({ detail: connection }: CustomEvent<Connection>) => {
		this.log("connection:close %s %p", connection.id, connection.remotePeer)
	}

	public async stop() {
		this.log("stop")
		if (this.#started === false) return
		this.#started = false

		this.#pubsub?.unsubscribe(this.messageLog.topic)

		for (const [peer, { stream, source }] of this.#pushStreams) {
			stream.close()
			source.end()
			this.#pushStreams.delete(peer)
		}

		await this.libp2p.unhandle(this.syncProtocol)
		await this.libp2p.unhandle(this.pushProtocol)

		if (this.#pushTopologyId !== null) {
			this.libp2p.unregister(this.#pushTopologyId)
			this.#pushTopologyId = null
		}

		this.libp2p.removeEventListener("connection:open", this.handleConnectionOpen)
		this.libp2p.removeEventListener("connection:close", this.handleConnectionClose)
		this.#pubsub?.removeEventListener("gossipsub:message", this.handleMessage)
	}

	public async publish(signedMessage: SignedMessage<Payload>, options: { sourceId?: string } = {}): Promise<PeerId[]> {
		if (!this.#started) {
			return []
		}

		const { id, key, value } = signedMessage
		const event: Partial<Event> = { insert: { key, value } }
		const data = Event.encode(event)

		if (this.#pubsub === null) {
			// If we're a lite client, then push directly to all of our topology peers

			const recipients: PeerId[] = []

			for (const peer of this.#pushStreams.keys()) {
				if (peer === options.sourceId) continue
				this.#push(peer, data) // TODO: doesn't guarantee we actually pushed to the peer...
				recipients.push(peerIdFromString(peer))
			}

			return recipients
		} else {
			// If we're a full client, publish to pubsub, and still push directly to all of our lite topology peers

			const recipients: PeerId[] = []

			for (const peer of this.litePeers) {
				if (peer === options.sourceId) continue
				this.#push(peer, data)
				// TODO: doesn't guarantee we actually pushed to the peer
				recipients.push(peerIdFromString(peer))
			}

			await this.#pubsub.publish(this.messageLog.topic, data).then(
				(result) => {
					this.log("published %s to %d recipients %O", id, result.recipients.length, result.recipients)
					recipients.push(...result.recipients)
				},
				(err) => this.log.error("failed to publish event: %O", err),
			)

			return recipients
		}
	}

	private handleMessage = ({ detail: { msgId, propagationSource, msg } }: GossipsubEvents["gossipsub:message"]) => {
		if (msg.topic !== this.messageLog.topic) {
			return
		}

		this.log("received gossipsub message %s via %p", msgId, propagationSource)

		const sourceId = propagationSource.toString()

		let event: Event
		try {
			event = Event.decode(msg.data)
		} catch (err) {
			this.log.error("error decoding gossipsub message: %O", err)
			this.#pubsub?.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
			return
		}

		if (event.insert === undefined) {
			this.log("ignoring gossipsub message %s", msgId)
			this.#pubsub?.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Ignore)
			return
		}

		let signedMessage: SignedMessage<Payload>
		try {
			signedMessage = this.messageLog.decode(event.insert.value)
			assert(equals(event.insert.key, signedMessage.key), "invalid key")
		} catch (err) {
			this.log.error("invalid message: %O", err)
			this.#pubsub?.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
			return
		}

		this.messageLog.insert(signedMessage, { peerId: sourceId, publish: false }).then(
			({ id }) => {
				this.#pubsub?.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Accept)

				let count = 0
				for (const peer of this.litePeers) {
					this.#push(peer, msg.data)
					count += 1
				}

				if (count > 0) {
					this.log("forwarded message %s to %d lite peers", id, count)
				}
			},
			(err) => {
				if (err instanceof CodeError && err.code === MISSING_PARENT) {
					this.#pubsub?.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Ignore)
					this.scheduleSync(propagationSource)
				} else {
					this.log.error("rejecting gossipsub message %s: %O", msgId, err)
					this.#pubsub?.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
				}
			},
		)
	}

	private async handleUpdate(propagationSource: PeerId, { heads }: Event.Update): Promise<TopicValidatorResult> {
		this.log("handling update: %o", heads.map(decodeId))

		const result = await this.messageLog.tree.read((txn) => {
			const missingParents = new Set<string>()
			for (const key of heads) {
				const leaf = txn.getNode(0, key)
				if (leaf === null) {
					missingParents.add(decodeId(key))
				}
			}

			if (missingParents.size === 0) {
				return TopicValidatorResult.Accept
			} else {
				return TopicValidatorResult.Ignore
			}
		})

		// Need to sync
		if (result === TopicValidatorResult.Ignore) {
			this.scheduleSync(propagationSource)
		}

		return result
	}

	private getPushSink = (connection: Connection, stream: Stream) => async (msgs: AsyncIterable<Uint8ArrayList>) => {
		const sourceId = connection.remotePeer.toString()
		try {
			for await (const msg of msgs) {
				const event = Event.decode(msg.subarray())
				if (event.insert !== undefined) {
					const signedMessage = this.messageLog.decode(event.insert.value)
					assert(equals(event.insert.key, signedMessage.key), "invalid key")

					try {
						await this.messageLog.insert(signedMessage, { publish: false, peerId: sourceId })
					} catch (err) {
						if (err instanceof CodeError && err.code === MISSING_PARENT) {
							this.scheduleSync(connection.remotePeer)
							continue
						} else {
							throw err
						}
					}

					this.publish(signedMessage, { sourceId })
				} else if (event.update !== undefined) {
					await this.handleUpdate(connection.remotePeer, event.update)
				}
			}
		} catch (err) {
			stream.abort(err instanceof Error ? err : new Error(`${err}`))
		}
	}

	private handleIncomingPush: StreamHandler = ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming push stream %s from peer %p", stream.id, peerId)

		const source = pushable()
		this.#pushStreams.set(peerId.toString(), { stream, source })
		Promise.all([
			// outgoing events
			pipe(source, lp.encode, stream.sink),
			// incoming events
			pipe(stream.source, lp.decode, this.getPushSink(connection, stream)).then(() => {
				source.end()
				stream.close()
				this.#pushStreams.delete(peerId.toString())
			}),
		]).finally(() => {
			this.#pushStreams.delete(peerId.toString())
			this.log("closed incoming push stream %s from peer %p", stream.id, peerId)
		})
	}

	private handleIncomingSync: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming sync stream %s from peer %p", stream.id, peerId)

		const timeoutController = new DelayableController(SYNC_TIMEOUT)
		const signal = anySignal([this.controller.signal, timeoutController.signal])
		signal.addEventListener("abort", (err) => {
			if (stream.status === "open") {
				stream.abort(new Error("TIMEOUT"))
			}
		})

		try {
			await this.messageLog.serve(async (txn) => {
				const server = new Server(txn)

				await pipe(
					stream.source,
					lp.decode,
					decodeRequests,
					async function* (reqs) {
						for await (const req of reqs) {
							timeoutController.delay()
							yield req
						}
					},
					(reqs) => server.handle(reqs),
					encodeResponses,
					lp.encode,
					stream.sink,
				)
			})

			this.log("closed incoming stream %s from peer %p", stream.id, peerId)
		} catch (err) {
			if (err instanceof Error && err.message === "TIMEOUT") {
				this.log.error("timed out incoming stream %s from peer %p", stream.id, peerId)
				stream.abort(err)
			} else if (err instanceof Error) {
				this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
				stream.abort(err)
			} else {
				this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
				stream.abort(new Error("internal error"))
			}
		} finally {
			timeoutController.clear()
			signal.clear()
		}
	}

	private scheduleSync(peerId: PeerId) {
		const id = peerId.toString()
		if (this.syncQueuePeers.has(id)) {
			this.log("already queued sync with %p", peerId)
			return
		}

		this.log("scheduling sync with %p", peerId)
		this.syncQueuePeers.add(id)
		this.syncQueue
			.add(() => this.sync(peerId))
			.catch((err) => this.log.error("sync failed: %O", err))
			.finally(() => this.syncQueuePeers.delete(id))
	}

	private async sync(peerId: PeerId) {
		this.log("initiating sync with %p", peerId)
		const connection = this.libp2p.getConnections(peerId).find((connection) => connection.transient === false)

		if (connection === undefined) {
			this.log("no longer connected to %p", peerId)
			return
		}

		await this.retry("sync", () => this.#sync(connection), {
			interval: SYNC_RETRY_INTERVAL,
			limit: SYNC_RETRY_LIMIT,
		})
	}

	async #sync(connection: Connection): Promise<void> {
		if (connection.status !== "open") {
			throw new Error("connection closed")
		}

		const peerId = connection.remotePeer

		const protocolSelectSignal = AbortSignal.timeout(DEFAULT_PROTOCOL_SELECT_TIMEOUT)
		const stream = await connection
			.newStream(this.syncProtocol, { negotiateFully: NEGOTIATE_FULLY, signal: protocolSelectSignal })
			.catch((err) => {
				this.log.error("failed to open outgoing sync stream: %O", err)
				throw err
			})

		this.log("opened outgoing sync stream %s to peer %p", stream.id, peerId)

		const timeoutController = new DelayableController(SYNC_TIMEOUT)
		const signal = anySignal([this.controller.signal, timeoutController.signal])
		signal.addEventListener("abort", (err) => {
			if (stream.status === "open") {
				stream.abort(new SyncTimeoutError())
			}
		})

		this.log("starting sync with peer %p", peerId)

		const client = new Client(stream)

		let messageCount = 0
		try {
			await this.messageLog.sync(
				client,
				async (signedMessage) => {
					await this.messageLog.insert(signedMessage, { publish: false })
					messageCount++
				},
				{ peerId: peerId.toString() },
			)
		} finally {
			timeoutController.clear()
			signal.clear()
			client.end()
			this.log("closed outgoing sync stream %s to peer %p", stream.id, peerId)
		}

		if (messageCount !== 0) {
			const [_, heads] = await this.messageLog.getClock()
			const data = Event.encode({ update: { heads: heads.map(encodeId) } })
			for (const peer of this.#pushStreams.keys()) {
				if (peer === peerId.toString()) continue
				this.#push(peer, data)
			}
		}
	}

	#push(peer: string, data: Uint8Array): void {
		this.log("pushing data to %s", peer)
		const { stream, source } = this.#pushStreams.get(peer) ?? {}
		if (stream === undefined || source === undefined) {
			return
		}

		if (stream.status !== "open") {
			this.#pushStreams.delete(peer)
			return
		}

		source.push(data)
	}

	private async retry(name: string, callback: () => Promise<void>, options: { interval: number; limit: number }) {
		for (let n = 0; n < options.limit; n++) {
			try {
				await callback()
				return
			} catch (err) {
				this.log.error("%s failed: %O", name, err)
				if (this.controller.signal.aborted) {
					break
				} else {
					const interval = Math.floor(Math.random() * options.interval)
					this.log("waiting %dms before trying %s again (%d/%d)", interval, name, n + 1, options.limit)
					await this.wait(interval)
					continue
				}
			}
		}

		throw new Error("exceeded sync retry limit")
	}

	private async wait(interval: number) {
		await wait(interval, { signal: this.controller.signal })
	}
}
