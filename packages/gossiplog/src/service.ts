import {
	PeerId,
	Startable,
	TypedEventEmitter,
	PubSub,
	TopicValidatorResult,
	Logger,
	Connection,
	StreamHandler,
} from "@libp2p/interface"

import { Registrar, ConnectionManager } from "@libp2p/interface-internal"

import { GossipSub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { logger } from "@libp2p/logger"
import PQueue from "p-queue"
import { anySignal } from "any-signal"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { bytesToHex } from "@noble/hashes/utils"

import type { Signature, Message, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { Event } from "#protocols/events"

import {
	DEFAULT_PROTOCOL_SELECT_TIMEOUT,
	MAX_INBOUND_STREAMS,
	MAX_OUTBOUND_STREAMS,
	MAX_SYNC_QUEUE_SIZE,
	SYNC_RETRY_INTERVAL,
	SYNC_RETRY_LIMIT,
	second,
} from "./constants.js"

import { AbstractGossipLog, GossipLogEvents } from "./AbstractGossipLog.js"

import { decodeId } from "./schema.js"
import { Client, decodeRequests, encodeResponses } from "./sync/index.js"

import { DelayableController, SyncDeadlockError, SyncTimeoutError, wait } from "./utils.js"
import { Server } from "./sync/server.js"

export const getProtocol = (topic: string) => `/canvas/sync/v1/${topic}`

export type GossipLogServiceComponents = {
	peerId: PeerId
	registrar: Registrar
	connectionManager: ConnectionManager
	pubsub?: PubSub
}

export interface GossipLogServiceInit {
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export class GossipLogService<Payload = unknown>
	extends TypedEventEmitter<GossipLogEvents<unknown>>
	implements Startable
{
	private static extractGossipSub(components: GossipLogServiceComponents): GossipSub {
		const { pubsub } = components
		assert(pubsub !== undefined, "pubsub service not found")
		assert(pubsub instanceof GossipSub)
		return pubsub
	}

	public readonly protocol = getProtocol(this.messageLog.topic)

	private readonly log: Logger
	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number
	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Map<string, Promise<void>>()
	private readonly topologyPeers = new Set<string>()
	private readonly controller = new AbortController()

	#registrarId: string | null = null
	#pubsub: GossipSub
	#started = false

	constructor(
		private readonly components: GossipLogServiceComponents,
		public readonly messageLog: AbstractGossipLog<Payload>,
		init: GossipLogServiceInit,
	) {
		super()
		this.log = logger(`canvas:gossiplog:[${this.messageLog.topic}]:service`)
		this.#pubsub = GossipLogService.extractGossipSub(components)

		this.maxInboundStreams = init.maxInboundStreams ?? MAX_INBOUND_STREAMS
		this.maxOutboundStreams = init.maxOutboundStreams ?? MAX_OUTBOUND_STREAMS
	}

	public isStarted() {
		return this.#started
	}

	public async start() {
		this.log("start")

		this.messageLog.addEventListener("sync", this.forwardEvent)
		this.messageLog.addEventListener("commit", this.forwardEvent)
		this.messageLog.addEventListener("message", this.forwardEvent)

		this.#pubsub.addEventListener("gossipsub:message", this.handleMessage)

		await this.components.registrar.handle(this.protocol, this.handleIncomingStream, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		this.#registrarId = await this.components.registrar.register(this.protocol, {
			notifyOnTransient: false,
			onConnect: async (peerId, connection) => {
				this.topologyPeers.add(peerId.toString())
				this.log("connected to peer %p", peerId)

				// having one peer wait an initial randomized interval
				// reduces the likelihood of deadlock to near-zero,
				// but it could still happen.
				if (connection.direction === "inbound") {
					const interval = second + Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
					this.log("waiting an initial %dms", interval)
					await this.wait(interval)
				}

				this.scheduleSync(peerId)
			},

			onDisconnect: (peerId) => {
				this.log("disconnected from %p", peerId)
				this.topologyPeers.delete(peerId.toString())
			},
		})

		this.#started = true
	}

	public async afterStart() {
		this.log("afterStart")
		this.#pubsub.subscribe(this.messageLog.topic)
	}

	public async beforeStop() {
		this.log("beforeStop")
		this.#pubsub.unsubscribe(this.messageLog.topic)
	}

	public async stop() {
		this.log("stop")
		this.#started = false
		this.#pubsub.removeEventListener("gossipsub:message", this.handleMessage)
		this.messageLog.removeEventListener("sync", this.forwardEvent)
		this.messageLog.removeEventListener("commit", this.forwardEvent)
		this.messageLog.removeEventListener("message", this.forwardEvent)

		await this.components.registrar.unhandle(this.protocol)
		if (this.#registrarId !== null) {
			this.components.registrar.unregister(this.#registrarId)
			this.#registrarId = null
		}
	}

	private forwardEvent = (event: CustomEvent) =>
		this.safeDispatchEvent(event.type as keyof GossipLogEvents<unknown>, event)

	public async append(
		payload: Payload,
		options: { signer?: Signer<Payload> } = {},
	): Promise<{ id: string; signature: Signature; message: Message<Payload>; recipients: Promise<PeerId[]> }> {
		const { id, signature, message } = await this.messageLog.write((txn) =>
			this.messageLog.append(txn, payload, options),
		)

		const [key, value] = this.messageLog.encode(signature, message)
		const data = Event.encode({ insert: { key, value } })

		const recipients = this.#pubsub.publish(this.messageLog.topic, data).then(
			({ recipients }) => {
				this.log("published message %s to %d recipients %O", id, recipients.length, recipients)
				return recipients
			},
			(err) => {
				this.log.error("failed to publish event: %O", err)
				return []
			},
		)

		return { id, signature, message, recipients }
	}

	public async insert(
		signature: Signature,
		message: Message<Payload>,
	): Promise<{ id: string; recipients: Promise<PeerId[]> }> {
		assert(message.topic === this.messageLog.topic, "wrong topic")

		const { id } = await this.messageLog.write((txn) => this.messageLog.insert(txn, signature, message))

		const [key, value] = this.messageLog.encode(signature, message)
		const data = Event.encode({ insert: { key, value } })
		const recipients = this.#pubsub.publish(message.topic, data).then(
			({ recipients }) => {
				this.log("published message %s to %d recipients %O", id, recipients.length, recipients)
				return recipients
			},
			(err) => {
				this.log.error("failed to publish event: %O", err)
				return []
			},
		)

		return { id, recipients }
	}

	private handleMessage = ({ detail: { msgId, propagationSource, msg } }: GossipsubEvents["gossipsub:message"]) => {
		if (msg.type !== "signed" || msg.topic !== this.messageLog.topic) {
			return
		}

		const sourceId = propagationSource.toString()

		let event: Event
		try {
			event = Event.decode(msg.data)
		} catch (err) {
			this.log.error("error decoding gossipsub message: %O", err)
			this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
			return
		}

		if (event.insert !== undefined) {
			this.handleInsert({ msgId, propagationSource, from: msg.from }, event.insert).then(
				(result) => this.#pubsub.reportMessageValidationResult(msgId, sourceId, result),
				(err) => {
					this.log.error("error handling insert event: %O", err)
					this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
				},
			)
		} else if (event.update !== undefined) {
			this.handleUpdate({ msgId, propagationSource, from: msg.from }, event.update).then(
				(result) => this.#pubsub.reportMessageValidationResult(msgId, sourceId, result),
				(err) => {
					this.log.error("error handling update event: %O", err)
					this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
				},
			)
		} else {
			this.log.error("error decoding gossipsub message (invalid type)")
			this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
		}
	}

	private async handleInsert(
		{ msgId, propagationSource, from }: { msgId: string; propagationSource: PeerId; from: PeerId },
		{ key, value }: Event.Insert,
	): Promise<TopicValidatorResult> {
		this.log("handling insert event %s from %p (via %p)", msgId, from, propagationSource)

		const [id, signature, message] = this.messageLog.decode(value)
		assert(decodeId(key) === id, "invalid message key")

		await this.messageLog.verifySignature(signature, message)

		const result = await this.messageLog.write(async (txn) => {
			const missingParents = await this.messageLog.getMissingParents(txn, message.parents)
			if (missingParents.size !== 0) {
				this.log("missing %d/%d parents", missingParents.size, message.parents.length)
				return TopicValidatorResult.Ignore
			}

			try {
				await this.messageLog.apply(txn, id, signature, message, [key, value])
				return TopicValidatorResult.Accept
			} catch (err) {
				return TopicValidatorResult.Reject
			}
		})

		// Need to sync
		if (result === TopicValidatorResult.Ignore) {
			this.scheduleSync(propagationSource)
		}

		return result
	}

	private async handleUpdate(
		{ msgId, propagationSource, from }: { msgId: string; propagationSource: PeerId; from: PeerId },
		{ heads }: Event.Update,
	): Promise<TopicValidatorResult> {
		this.log("handling update event %s from %p (via %p)", msgId, from, propagationSource)

		const missingParents = await this.messageLog.read(async (txn) => {
			const missingParents = new Set<string>()
			for (const key of heads) {
				const leaf = await txn.messages.getNode(0, key)
				if (leaf === null) {
					missingParents.add(decodeId(key))
				}
			}

			return missingParents
		})

		if (missingParents.size > 0) {
			this.scheduleSync(propagationSource)
			return TopicValidatorResult.Ignore
		} else {
			return TopicValidatorResult.Accept
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming stream %s from peer %p", stream.id, peerId)

		const timeoutController = new DelayableController(3 * second)
		const signal = anySignal([this.controller.signal, timeoutController.signal])
		signal.addEventListener("abort", (err) => {
			if (stream.status === "open") {
				stream.abort(new Error("TIMEOUT"))
			}
		})

		try {
			await this.messageLog.serve(
				async (source) => {
					const server = new Server(source)
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
				},
				{ targetId: peerId.toString() },
			)

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
			signal.clear()
		}
	}

	private scheduleSync(peerId: PeerId): Promise<void> {
		const id = peerId.toString()
		if (this.syncQueuePeers.has(id)) {
			this.log("already queued sync with %p", peerId)
			return this.syncQueuePeers.get(id)!
		}

		const p = this.syncQueue
			.add(() => this.sync(peerId), { priority: 0 })
			.catch((err) => this.log.error("sync failed: %O", err))
			.finally(() => this.syncQueuePeers.delete(id))

		this.syncQueuePeers.set(id, p)
		return p
	}

	private async sync(peerId: PeerId) {
		const connection = this.components.connectionManager
			.getConnections(peerId)
			.find((connection) => connection.transient === false)

		if (connection === undefined) {
			this.log("no longer connected to %p", peerId)
			return
		}

		for (let n = 0; n < SYNC_RETRY_LIMIT; n++) {
			try {
				await this.#sync(connection)
				return
			} catch (err) {
				if (err instanceof SyncDeadlockError) {
					this.log("deadlock with %p", peerId)
				} else {
					this.log.error("failed to sync with peer: %O", err)
				}

				if (this.controller.signal.aborted) {
					break
				} else {
					const interval = Math.floor(Math.random() * SYNC_RETRY_INTERVAL)
					this.log("waiting %dms before trying again (%d/%d)", interval, n + 1, SYNC_RETRY_LIMIT)
					await this.wait(interval)
					continue
				}
			}
		}

		throw new Error("exceeded sync retry limit")
	}

	async #sync(connection: Connection): Promise<void> {
		if (connection.status !== "open") {
			throw new Error("connection closed")
		}

		const peerId = connection.remotePeer
		const sourceId = peerId.toString()

		const selectProtocolSignal = AbortSignal.timeout(DEFAULT_PROTOCOL_SELECT_TIMEOUT)
		const stream = await connection
			.newStream(this.protocol, { negotiateFully: false, signal: selectProtocolSignal })
			.catch((err) => {
				this.log.error("failed to open outgoing stream: %O", err)
				throw err
			})

		this.log("opened outgoing stream %s to peer %p", stream.id, peerId)

		const timeoutController = new DelayableController(3 * second)
		const signal = anySignal([this.controller.signal, timeoutController.signal])
		signal.addEventListener("abort", (err) => {
			if (stream.status === "open") {
				stream.abort(new SyncTimeoutError())
			}
		})

		this.log("initiating sync with peer %p", peerId)

		const client = new Client(stream)
		try {
			const { root, heads } = await this.messageLog.write(async (txn) => {
				let messageCount = 0

				for await (const [_, signature, message, entry] of this.messageLog.sync(txn, client, { sourceId })) {
					timeoutController.delay()

					await this.messageLog.insert(txn, signature, message, entry)
					messageCount += 1
				}

				const root = await txn.messages.getRoot()
				if (messageCount === 0) {
					return { root, heads: null }
				} else {
					const heads = await txn.getHeads()
					return { root, heads }
				}
			})

			if (heads !== null) {
				const data = Event.encode({ update: { heads } })
				this.#pubsub.publish(this.messageLog.topic, data).then(
					({ recipients }) => this.log("published update event to %d recipients %O", recipients.length, recipients),
					(err) => this.log.error("failed to publish update event: %O", err),
				)
			}
		} finally {
			signal.clear()
			client.end()
			this.log("closed outgoing stream %s to peer %p", stream.id, peerId)
		}
	}

	private async wait(interval: number) {
		await wait(interval, { signal: this.controller.signal })
	}
}

export const gossiplog =
	<Payload>(messageLog: AbstractGossipLog<Payload>, init: GossipLogServiceInit) =>
	(components: GossipLogServiceComponents) =>
		new GossipLogService<Payload>(components, messageLog, init)
