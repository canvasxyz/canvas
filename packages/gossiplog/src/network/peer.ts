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

import { GossipSub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { logger } from "@libp2p/logger"
import * as lp from "it-length-prefixed"
import { pipe } from "it-pipe"
import { Pushable, pushable } from "it-pushable"
import { equals } from "uint8arrays"
import PQueue from "p-queue"

import { assert } from "@canvas-js/utils"

import { Event } from "#protocols/events"

import type { ServiceMap, NetworkConfig } from "../interface.js"
import { AbstractGossipLog, GossipLogEvents } from "../AbstractGossipLog.js"

import { decodeId, encodeId } from "../ids.js"
import { Client, Server } from "../sync/index.js"
import {
	DEFAULT_PROTOCOL_SELECT_TIMEOUT,
	MAX_INBOUND_STREAMS,
	MAX_OUTBOUND_STREAMS,
	NEGOTIATE_FULLY,
} from "../constants.js"
import { codes } from "../utils.js"

import { SignedMessage } from "../SignedMessage.js"
import { getLibp2p } from "./libp2p.js"
import { decodeEvents, encodeEvents, getPushProtocol, getSyncProtocol } from "./utils.js"

export class NetworkPeer<Payload = unknown> {
	private static extractGossipSub(libp2p: Libp2p<ServiceMap>): GossipSub {
		const pubsub = libp2p.services.pubsub
		assert(pubsub instanceof GossipSub, "expected pubsub instanceof GossipSub")
		return pubsub
	}

	public readonly pubsub: GossipSub

	private readonly log: Logger
	private readonly syncProtocol = getSyncProtocol(this.messageLog.topic)
	private readonly pushProtocol = getPushProtocol(this.messageLog.topic)
	private readonly syncQueue = new PQueue({ concurrency: 1 })
	private readonly syncQueuePeers = new Set<string>()

	private readonly controller = new AbortController()
	private readonly pushTopology = new Set<string>()
	private readonly eventSources = new Map<string, Pushable<Event>>()

	#pushTopologyId: string | null = null
	#started = this.libp2p.status === "started"

	public static async create<Payload>(gossipLog: AbstractGossipLog<Payload>, { start, ...config }: NetworkConfig) {
		const libp2p = await getLibp2p(gossipLog.topic, config)
		const network = new NetworkPeer(libp2p, gossipLog)

		if (start ?? false) {
			await network.start()
		}

		return network
	}

	constructor(public readonly libp2p: Libp2p<ServiceMap>, public readonly messageLog: AbstractGossipLog<Payload>) {
		this.log = logger(`canvas:network:peer`)
		this.pubsub = NetworkPeer.extractGossipSub(libp2p)
	}

	public get peerId() {
		return this.libp2p.peerId
	}

	public async start() {
		if (this.#started) {
			return
		}

		this.log("start")
		this.#started = true

		this.libp2p.addEventListener("connection:open", this.handleConnectionOpen)
		this.libp2p.addEventListener("connection:close", this.handleConnectionClose)
		this.pubsub.addEventListener("gossipsub:message", this.handleGossipsubMessage)
		this.pubsub.addEventListener("gossipsub:graft", this.handleGossipsubGraft)
		this.pubsub.addEventListener("gossipsub:prune", this.handleGossipsubPrune)

		// this.pubsub.addEventListener("gossipsub:graft", ({detail: peer}) => this.messageLog.)

		this.messageLog.addEventListener("message", this.handleMessage)
		this.messageLog.addEventListener("sync", this.handleSync)

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
		await this.libp2p.handle(this.syncProtocol, this.handleSyncStream, {
			maxInboundStreams: MAX_INBOUND_STREAMS,
			maxOutboundStreams: MAX_OUTBOUND_STREAMS,
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
		 */
		await this.libp2p.handle(this.pushProtocol, this.handlePushStream, {
			maxInboundStreams: MAX_INBOUND_STREAMS,
			maxOutboundStreams: MAX_OUTBOUND_STREAMS,
		})

		this.#pushTopologyId = await this.libp2p.register(this.pushProtocol, {
			notifyOnTransient: false,
			onConnect: (peerId, connection) => {
				this.log("connected to %p", peerId)
				this.pushTopology.add(peerId.toString())

				if (connection.direction === "outbound") {
					this.newStream(connection, this.pushProtocol).then(
						(stream) => this.handlePushStream({ connection, stream }),
						(err) => this.log.error("failed to open outgoing push stream: %O", err),
					)
				}
			},

			onDisconnect: (peerId) => {
				this.log("disconnected %p", peerId)
				this.pushTopology.delete(peerId.toString())
			},
		})

		await this.libp2p.start()

		this.pubsub.subscribe(this.messageLog.topic)
	}

	public async stop() {
		this.log("stop")
		if (this.libp2p.status !== "started") return
		if (this.#started === false) return
		this.#started = false

		this.controller.abort()
		this.pubsub.unsubscribe(this.messageLog.topic)

		for (const [peer, source] of this.eventSources) {
			source.end()
			this.eventSources.delete(peer)
		}

		await this.libp2p.unhandle(this.syncProtocol)
		await this.libp2p.unhandle(this.pushProtocol)

		if (this.#pushTopologyId !== null) {
			this.libp2p.unregister(this.#pushTopologyId)
			this.#pushTopologyId = null
		}

		this.messageLog.removeEventListener("message", this.handleMessage)
		this.messageLog.removeEventListener("sync", this.handleSync)

		this.libp2p.removeEventListener("connection:open", this.handleConnectionOpen)
		this.libp2p.removeEventListener("connection:close", this.handleConnectionClose)
		this.pubsub.removeEventListener("gossipsub:message", this.handleGossipsubMessage)
		this.pubsub.removeEventListener("gossipsub:graft", this.handleGossipsubGraft)
		this.pubsub.removeEventListener("gossipsub:prune", this.handleGossipsubPrune)

		await this.libp2p.stop()
	}

	private async newStream(connection: Connection, protocol: string): Promise<Stream> {
		assert(connection.status === "open", "connection closed")

		const protocolSelectSignal = AbortSignal.timeout(DEFAULT_PROTOCOL_SELECT_TIMEOUT)
		const stream = await connection.newStream(protocol, {
			negotiateFully: NEGOTIATE_FULLY,
			signal: protocolSelectSignal,
		})

		return stream
	}

	private handleConnectionOpen = ({ detail: connection }: CustomEvent<Connection>) => {
		this.log("connection:open %s %p", connection.id, connection.remotePeer)
		this.messageLog.dispatchEvent(new CustomEvent("connect", { detail: { peer: connection.remotePeer.toString() } }))
	}

	private handleConnectionClose = ({ detail: connection }: CustomEvent<Connection>) => {
		this.log("connection:close %s %p", connection.id, connection.remotePeer)
		this.messageLog.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: connection.remotePeer.toString() } }))
	}

	private handleGossipsubGraft = ({ detail: { topic, peerId } }: GossipsubEvents["gossipsub:graft"]) => {
		if (topic !== this.messageLog.topic) {
			return
		}

		this.log("gossipsub:graft %s", peerId)
		this.messageLog.dispatchEvent(new CustomEvent("graft", { detail: { peer: peerId } }))
	}

	private handleGossipsubPrune = ({ detail: { topic, peerId } }: GossipsubEvents["gossipsub:prune"]) => {
		if (topic !== this.messageLog.topic) {
			return
		}

		this.log("gossipsub:prune %s", peerId)
		this.messageLog.dispatchEvent(new CustomEvent("prune", { detail: { peer: peerId } }))
	}

	private handleMessage = ({ detail: { id, key, value, source } }: GossipLogEvents["message"]) => {
		if (!this.#started) {
			return
		}

		if (source === undefined || source.type === "push") {
			const event: Partial<Event> = { insert: { key, value } }
			const data = Event.encode(event)
			this.pubsub.publish(this.messageLog.topic, data).then(
				() => this.log("published %s", id),
				(err) => this.log.error("failed to publish message %s: %O", id, err),
			)
		}
	}

	private handleSync = ({ detail: { messageCount, peer } }: GossipLogEvents["sync"]) => {
		if (messageCount > 0) {
			this.messageLog.getClock().then(([_, parents]) => {
				const heads = parents.map(encodeId)
				for (const [id, eventSource] of this.eventSources) {
					if (peer === id) {
						continue
					} else {
						eventSource.push({ update: { heads } })
					}
				}
			})
		}
	}

	private handleGossipsubMessage = ({
		detail: { msgId, propagationSource, msg },
	}: GossipsubEvents["gossipsub:message"]) => {
		if (msg.topic !== this.messageLog.topic) {
			return
		}

		const sourceId = propagationSource.toString()

		this.log("received gossipsub message %s via %s", msgId, sourceId)

		let event: Event
		try {
			event = Event.decode(msg.data)
		} catch (err) {
			this.log.error("error decoding gossipsub message: %O", err)
			this.log.trace("rejecting gossipsub message %s", msgId)
			this.pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
			return
		}

		if (event.insert === undefined) {
			this.log.trace("ignoring gossipsub message %s", msgId)
			this.pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Ignore)
			return
		}

		let signedMessage: SignedMessage<Payload>
		try {
			signedMessage = this.messageLog.decode(event.insert.value, {
				source: { type: "pubsub", peer: sourceId },
			})

			assert(equals(event.insert.key, signedMessage.key), "invalid key")
		} catch (err) {
			this.log.error("invalid message: %O", err)
			this.log.trace("rejecting gossipsub message %s", msgId)
			this.pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
			return
		}

		this.messageLog.insert(signedMessage).then(
			() => {
				this.log.trace("accepting gossipsub message %s", msgId)
				this.pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Accept)
			},
			(err) => {
				if (err instanceof CodeError && err.code === codes.MISSING_PARENT) {
					this.log.trace("ignoring gossipsub message %s", msgId)
					this.pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Ignore)
					this.scheduleSync(propagationSource)
				} else {
					this.log.error("error inserting message %s: %O", signedMessage.id, err)
					this.log.trace("rejecting gossipsub message %s", msgId)
					this.pubsub.reportMessageValidationResult(msgId, sourceId, TopicValidatorResult.Reject)
				}
			},
		)
	}

	private getEventSink = (connection: Connection, stream: Stream) => async (events: AsyncIterable<Event>) => {
		try {
			for await (const event of events) {
				if (event.insert !== undefined) {
					// TODO: reject insert events from libp2p peers?
					await this.handleInsertEvent(connection.remotePeer, event.insert)
				} else if (event.update !== undefined) {
					await this.handleUpdateEvent(connection.remotePeer, event.update)
				}
			}
		} catch (err) {
			stream.abort(err instanceof Error ? err : new Error(`${err}`))
		}
	}

	private async handleInsertEvent(peerId: PeerId, { key, value }: Event.Insert) {
		const signedMessage = this.messageLog.decode(value, {
			source: { type: "push", peer: peerId.toString() },
		})

		assert(equals(key, signedMessage.key), "invalid key")

		try {
			await this.messageLog.insert(signedMessage)
		} catch (err) {
			if (err instanceof CodeError && err.code === codes.MISSING_PARENT) {
				this.scheduleSync(peerId)
				return
			} else {
				throw err
			}
		}
	}

	private async handleUpdateEvent(peerId: PeerId, { heads }: Event.Update): Promise<void> {
		this.log("handling update: %o", heads.map(decodeId))

		const result = await this.messageLog.tree.read((txn) => {
			for (const key of heads) {
				const leaf = txn.getNode(0, key)
				if (leaf === null) {
					return key
				}
			}

			return null
		})

		if (result !== null) {
			this.scheduleSync(peerId)
		}
	}

	private handlePushStream: StreamHandler = ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened %s push stream %s from peer %p", stream.direction, stream.id, peerId)

		const eventSource = pushable<Event>({ objectMode: true })
		this.eventSources.set(peerId.toString(), eventSource)

		const eventSink = this.getEventSink(connection, stream)

		pipe(eventSource, encodeEvents, lp.encode, stream, lp.decode, decodeEvents, eventSink)
			.catch((err) => this.log.error("error in %s push stream %s: %O", stream.direction, stream.id, err))
			.finally(() => {
				eventSource.end()
				this.eventSources.delete(peerId.toString())

				stream.close()
				this.log("closed %s push stream %s from peer %p", stream.direction, stream.id, peerId)
			})

		this.messageLog.getClock().then(([_, heads]) => {
			eventSource.push({ update: { heads: heads.map(encodeId) } })
		})
	}

	private handleSyncStream: StreamHandler = async ({ connection, stream }) => {
		const peerId = connection.remotePeer
		this.log("opened incoming sync stream %s from peer %p", stream.id, peerId)

		try {
			await this.messageLog.serve((txn) => Server.handleStream(txn, stream))
			stream.close()
		} catch (err) {
			if (err instanceof Error) {
				this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
				stream.abort(err)
			} else {
				this.log.error("aborting incoming stream %s from peer %p: %O", stream.id, peerId, err)
				stream.abort(new Error("internal error"))
			}
		} finally {
			this.log("closed incoming stream %s from peer %p", stream.id, peerId)
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

	private async sync(peerId: PeerId): Promise<void> {
		this.log("initiating sync with %p", peerId)

		const connection = this.libp2p
			.getConnections(peerId)
			.find((connection) => connection.transient === false && connection.status === "open")

		if (connection === undefined) {
			this.log("no longer connected to %p", peerId)
			return
		}

		do {
			let stream: Stream
			try {
				stream = await this.newStream(connection, this.syncProtocol)
			} catch (err) {
				this.log.error("failed to open outgoing sync stream: %O", err)
				return
			}

			this.log("opened outgoing sync stream %s to peer %p", stream.id, peerId)

			const client = new Client(stream)
			try {
				const result = await this.messageLog.sync(client)
				if (result.complete) {
					break
				} else {
					continue
				}
			} catch (err) {
				this.log.error("sync failed: %O", err)
				return
			} finally {
				client.end()
				stream.close().then(
					() => this.log("closed outgoing sync stream %s", stream.id),
					(err) => this.log.error("error closing sync stream %s: %O", stream.id, err),
				)
			}
		} while (connection.status === "open")
	}
}
