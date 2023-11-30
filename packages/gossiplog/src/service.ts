import type { PeerId } from "@libp2p/interface-peer-id"

import type { Registrar } from "@libp2p/interface-internal/registrar"
import type { ConnectionManager } from "@libp2p/interface-internal/connection-manager"
import type { PubSub, Message as PubSubMessage } from "@libp2p/interface/pubsub"
import type { Startable } from "@libp2p/interface/startable"
import { EventEmitter } from "@libp2p/interface/events"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { logger } from "@libp2p/logger"

import type { Signature } from "@canvas-js/signed-cid"
import type { Message, Signer } from "@canvas-js/interfaces"

import { AbstractGossipLog, GossipLogEvents } from "./AbstractGossipLog.js"

import { decodeId } from "./schema.js"
import { SyncService, SyncOptions } from "./sync/service.js"
import { assert } from "./utils.js"

export type GossipLogServiceComponents = {
	peerId: PeerId
	registrar: Registrar
	connectionManager: ConnectionManager
	pubsub?: PubSub
}

export interface GossipLogServiceInit {
	sync?: boolean
}

export class GossipLogService extends EventEmitter<GossipLogEvents<unknown, unknown>> implements Startable {
	private static extractGossipSub(components: GossipLogServiceComponents): GossipSub {
		const { pubsub } = components
		assert(pubsub !== undefined, "pubsub service not found")
		assert(pubsub instanceof GossipSub)
		return pubsub
	}

	public static topicPrefix = "canvas/" as const

	private readonly sync: boolean
	private readonly log = logger(`canvas:gossiplog`)

	#started = false

	#messageLogs = new Map<string, AbstractGossipLog<unknown, unknown>>()
	#syncServices = new Map<string, SyncService<unknown, unknown>>()
	#pubsub: GossipSub

	constructor(
		private readonly components: GossipLogServiceComponents,
		init: GossipLogServiceInit,
	) {
		super()
		this.sync = init.sync ?? true
		this.#pubsub = GossipLogService.extractGossipSub(components)
	}

	public isStarted() {
		return this.#started
	}

	public async start() {
		this.log("start")
		this.#pubsub.addEventListener("message", this.handleMessage)
		this.#started = true
	}

	public async afterStart() {
		this.log("afterStart")
		for (const syncService of this.#syncServices.values()) {
			await syncService.start()
		}

		for (const topic of this.#messageLogs.keys()) {
			this.#pubsub.subscribe(GossipLogService.topicPrefix + topic)
		}
	}

	public async beforeStop() {
		this.log("beforeStop")
		await Promise.all(Array.from(this.#syncServices.values()).map((syncService) => syncService.stop()))
		this.#syncServices.clear()
	}

	public async stop() {
		this.log("stop")
		this.#pubsub.removeEventListener("message", this.handleMessage)
		this.#messageLogs.clear()
		this.#syncServices.clear()
		this.#started = false
	}

	public async subscribe<Payload, Result>(
		messageLog: AbstractGossipLog<Payload, Result>,
		options: SyncOptions = {},
	): Promise<void> {
		this.log("subscribing to %s", messageLog.topic)
		this.#messageLogs.set(messageLog.topic, messageLog as AbstractGossipLog<unknown, unknown>)
		messageLog.addEventListener("sync", this.forwardEvent)
		messageLog.addEventListener("commit", this.forwardEvent)
		messageLog.addEventListener("message", this.forwardEvent)

		if (this.sync) {
			const syncService = new SyncService(this.components, messageLog, options)
			this.#syncServices.set(messageLog.topic, syncService as SyncService<unknown, unknown>)

			if (this.#started) {
				await syncService.start()
			}
		}

		if (this.#started) {
			this.#pubsub.subscribe(GossipLogService.topicPrefix + messageLog.topic)
		}
	}

	public async unsubscribe(topic: string): Promise<void> {
		this.log("unsubscribing from %s", topic)

		if (this.#started) {
			this.#pubsub.unsubscribe(GossipLogService.topicPrefix + topic)
		}

		const syncService = this.#syncServices.get(topic)
		if (syncService !== undefined) {
			await syncService.stop()
			this.#syncServices.delete(topic)
		}

		const messageLog = this.#messageLogs.get(topic)
		if (messageLog !== undefined) {
			messageLog.removeEventListener("sync", this.forwardEvent)
			messageLog.removeEventListener("commit", this.forwardEvent)
			messageLog.removeEventListener("message", this.forwardEvent)
			this.#messageLogs.delete(topic)
		}
	}

	private forwardEvent = (event: CustomEvent) =>
		this.safeDispatchEvent(event.type as keyof GossipLogEvents<unknown, unknown>, event)

	public async append<Payload, Result>(
		topic: string,
		payload: Payload,
		options: { signer?: Signer<Message<Payload>> } = {},
	): Promise<{ id: string; result: Result; recipients: Promise<PeerId[]> }> {
		const messageLog = this.#messageLogs.get(topic) as AbstractGossipLog<Payload, Result> | undefined
		assert(messageLog !== undefined, "no subscription for topic")

		const { id, signature, message, result } = await messageLog.append(payload, options)

		if (this.#started) {
			const [key, value] = messageLog.encode(signature, message)
			assert(decodeId(key) === id)

			const recipients = this.#pubsub.publish(GossipLogService.topicPrefix + topic, value).then(
				({ recipients }) => {
					this.log("published message %s to %d recipients %O", id, recipients.length, recipients)
					return recipients
				},
				(err) => {
					this.log.error("failed to publish event: %O", err)
					return []
				},
			)

			return { id, result, recipients }
		} else {
			return { id, result, recipients: Promise.resolve([]) }
		}
	}

	public async insert<Payload, Result = unknown>(
		signature: Signature,
		message: Message<Payload>,
	): Promise<{ id: string; recipients: Promise<PeerId[]> }> {
		const messageLog = this.#messageLogs.get(message.topic) as AbstractGossipLog<Payload, Result> | undefined
		assert(messageLog !== undefined, "topic not found")

		const { id } = await messageLog.insert(signature, message)

		if (this.#started) {
			const [key, value] = messageLog.encode(signature, message)
			const id = decodeId(key)
			const recipients = this.#pubsub.publish(GossipLogService.topicPrefix + message.topic, value).then(
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
		} else {
			return { id, recipients: Promise.resolve([]) }
		}
	}

	public getTopics() {
		return [...this.#messageLogs.keys()]
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<PubSubMessage>) => {
		if (!msg.topic.startsWith(GossipLogService.topicPrefix)) {
			return
		}

		const topic = msg.topic.slice(GossipLogService.topicPrefix.length)
		const messageLog = this.#messageLogs.get(topic)
		if (messageLog === undefined) {
			return
		}

		const [id, signature, message] = messageLog.decode(msg.data)

		this.log("received message %s via gossipsub on %s", id, topic)
		await messageLog.insert(signature, message)
	}
}

export const gossiplog = (init: GossipLogServiceInit) => (components: GossipLogServiceComponents) =>
	new GossipLogService(components, init)
