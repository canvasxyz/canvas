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
import * as cbor from "@ipld/dag-cbor"

import { pushable } from "it-pushable"

import type { Entry } from "@canvas-js/okra"
import type { Signature, Message, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { Event } from "#protocols/events"

import {
	DEFAULT_PROTOCOL_SELECT_TIMEOUT,
	MAX_INBOUND_STREAMS,
	MAX_OUTBOUND_STREAMS,
	SYNC_RETRY_INTERVAL,
	SYNC_RETRY_LIMIT,
	second,
} from "../constants.js"

import { AbstractGossipLog, GossipLogEvents } from "../AbstractGossipLog.js"

import { decodeId, encodeId } from "../ids.js"
import { Client, decodeRequests, encodeResponses } from "../sync/index.js"

import { DelayableController, SyncDeadlockError, SyncTimeoutError, wait } from "../utils.js"
import { Server } from "../sync/server.js"
import { equals } from "uint8arrays"

export const getSyncProtocol = (topic: string) => `/canvas/sync/v1/${topic}`
export const getPushProtocol = (topic: string) => `/canvas/sync/v1/${topic}/push`

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

	public readonly syncProtocol = getSyncProtocol(this.messageLog.topic)
	public readonly pushProtocol = getPushProtocol(this.messageLog.topic)

	private readonly log: Logger
	private readonly maxInboundStreams: number
	private readonly maxOutboundStreams: number
	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()

	private readonly pushQueue = new PQueue({ concurrency: 16 })

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

		await this.components.registrar.handle(this.pushProtocol, this.handleIncomingPush, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		await this.components.registrar.handle(this.syncProtocol, this.handleIncomingSync, {
			maxInboundStreams: this.maxInboundStreams,
			maxOutboundStreams: this.maxOutboundStreams,
		})

		this.#registrarId = await this.components.registrar.register(this.syncProtocol, {
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

				const [_, parentIds] = await this.messageLog.getClock()
				const heads = parentIds.map(encodeId)
				this.schedulePush(peerId, heads)
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

		await this.components.registrar.unhandle(this.syncProtocol)
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
		const signedMessage = await this.messageLog.append(payload, options)

		const data = Event.encode({ insert: { key: signedMessage.key, value: signedMessage.value } })
		const recipients = this.#pubsub.publish(this.messageLog.topic, data).then(
			({ recipients }) => {
				this.log("published message %s to %d recipients %O", signedMessage.id, recipients.length, recipients)
				return recipients
			},
			(err) => {
				this.log.error("failed to publish event: %O", err)
				return []
			},
		)

		return {
			id: signedMessage.id,
			signature: signedMessage.signature,
			message: signedMessage.message,
			recipients,
		}
	}

	public async insert(
		signature: Signature,
		message: Message<Payload>,
	): Promise<{ id: string; recipients: Promise<PeerId[]> }> {
		assert(message.topic === this.messageLog.topic, "wrong topic")

		const signedMessage = this.messageLog.encode(signature, message)
		this.messageLog.insert(signedMessage)

		const data = Event.encode({ insert: { key: signedMessage.key, value: signedMessage.value } })
		const recipients = this.#pubsub.publish(message.topic, data).then(
			({ recipients }) => {
				this.log("published message %s to %d recipients %O", signedMessage.id, recipients.length, recipients)
				return recipients
			},
			(err) => {
				this.log.error("failed to publish event: %O", err)
				return []
			},
		)

		return { id: signedMessage.id, recipients }
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
			console.error("error decoding gossipsub message", err)
			this.log.error("error decoding gossipsub message: %O", err)
			this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
			return
		}

		if (event.insert !== undefined) {
			const { key, value } = event.insert
			this.handleInsert([key, value]).then(
				(result) => {
					this.#pubsub.reportMessageValidationResult(msgId, sourceId, result)
					if (result === TopicValidatorResult.Ignore) {
						this.scheduleSync(propagationSource)
					}
				},
				(err) => {
					this.log.error("error handling gossipsub message: %O", err)
					this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
				},
			)
		} else {
			console.error("IGNORING MESSAGE")
			this.#pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Ignore)
		}
	}

	private async handleInsert([key, value]: Entry): Promise<TopicValidatorResult> {
		const signedMessage = this.messageLog.decode(value)
		assert(equals(key, signedMessage.key), "invalid key")

		await this.messageLog.verifySignature(signedMessage.signature, signedMessage.message)

		await this.messageLog.insert(signedMessage)
		return TopicValidatorResult.Accept

		// return await this.messageLog.write(async (txn) => {
		// 	const missingParents = await this.messageLog.getMissingParents(txn, message.parents)
		// 	if (missingParents.size !== 0) {
		// 		this.log("missing %d/%d parents", missingParents.size, message.parents.length)
		// 		return TopicValidatorResult.Ignore
		// 	}

		// 	try {
		// 		await this.messageLog.apply(txn, id, signature, message, [key, value])
		// 		return TopicValidatorResult.Accept
		// 	} catch (err) {
		// 		return TopicValidatorResult.Reject
		// 	}
		// })
	}

	private async handleUpdate(propagationSource: PeerId, heads: Uint8Array[]): Promise<TopicValidatorResult> {
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

	private handleIncomingPush: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming push stream %s from peer %p", stream.id, peerId)

		pipe(stream.source, lp.decode, async (msgs) => {
			const { value: msg, done } = await msgs.next()
			assert(done === false && msg !== undefined)
			const heads = cbor.decode<Uint8Array[]>(msg.subarray())
			await msgs.next().then((result) => assert(result.done))

			this.handleUpdate(connection.remotePeer, heads)
		})
	}

	private handleIncomingSync: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming sync stream %s from peer %p", stream.id, peerId)

		const timeoutController = new DelayableController(3 * second)
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
			signal.clear()
		}
	}

	private schedulePush(peerId: PeerId, heads: Uint8Array[]) {
		this.log("scheduling push to %p", peerId)
		this.pushQueue
			.add(async () => {
				await this.push(peerId, heads)
			})
			.catch((err) => this.log.error("push failed: %O", err))
	}

	private async push(peerId: PeerId, heads: Uint8Array[]) {
		const connection = this.components.connectionManager
			.getConnections(peerId)
			.find((connection) => connection.transient === false)

		if (connection === undefined) {
			this.log("cancelling push: no longer connected to %p", peerId)
			return
		}

		const protocolSelectSignal = AbortSignal.timeout(DEFAULT_PROTOCOL_SELECT_TIMEOUT)
		const stream = await connection
			.newStream(this.pushProtocol, { negotiateFully: false, signal: protocolSelectSignal })
			.catch((err) => {
				this.log.error("failed to open outgoing push stream: %O", err)
				throw err
			})

		this.log("opened outgoing push stream %s to peer %p", stream.id, peerId)

		try {
			const source = pushable()
			await Promise.all([
				// ...
				pipe(source, lp.encode, stream.sink),
				// ...
				source.push(cbor.encode(heads)).end().onEmpty(),
			])

			await stream.close()
		} catch (err) {
			this.log.error("error sending push: %o", err)
			if (err instanceof Error) {
				stream.abort(err)
			} else {
				stream.abort(new Error())
			}
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

		const protocolSelectSignal = AbortSignal.timeout(DEFAULT_PROTOCOL_SELECT_TIMEOUT)
		const stream = await connection
			.newStream(this.syncProtocol, { negotiateFully: false, signal: protocolSelectSignal })
			.catch((err) => {
				this.log.error("failed to open outgoing sync stream: %O", err)
				throw err
			})

		this.log("opened outgoing sync stream %s to peer %p", stream.id, peerId)

		const timeoutController = new DelayableController(3 * second)
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
			const result = await this.messageLog.sync(client, { sourceId })
			messageCount = result.messageCount
		} finally {
			signal.clear()
			client.end()
			this.log("closed outgoing stream %s to peer %p", stream.id, peerId)
		}

		if (messageCount !== 0) {
			const [_, parentIds] = await this.messageLog.getClock()
			const heads = parentIds.map(encodeId)
			for (const peer of this.#pubsub.getSubscribers(this.messageLog.topic)) {
				this.schedulePush(peer, heads)
			}
		}
	}

	private async wait(interval: number) {
		await wait(interval, { signal: this.controller.signal })
	}
}

export const gossiplog =
	<Payload>(messageLog: AbstractGossipLog<Payload>, init: GossipLogServiceInit = {}) =>
	(components: GossipLogServiceComponents) =>
		new GossipLogService<Payload>(components, messageLog, init)
