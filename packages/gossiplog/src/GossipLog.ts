import type { PeerId } from "@libp2p/interface-peer-id"
import type { ConnectionManager } from "@libp2p/interface-connection-manager"
import type { Registrar } from "@libp2p/interface-registrar"
import type { Message as PubSubMessage } from "@libp2p/interface-pubsub"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { Startable } from "@libp2p/interfaces/startable"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"
import { logger } from "@libp2p/logger"
import { base32 } from "multiformats/bases/base32"
import { bytesToHex } from "@noble/hashes/utils"

import type { Node } from "@canvas-js/okra"
import type { Signature } from "@canvas-js/signed-cid"
import type { IPLDValue, Message } from "@canvas-js/interfaces"

import openMessageLog, { AbstractMessageLog, MessageSigner } from "#store"

import { SyncService, SyncOptions } from "./SyncService.js"
import { Awaitable, assert, nsidPattern } from "./utils.js"

export type GossipLogComponents = {
	peerId: PeerId
	registrar: Registrar
	connectionManager: ConnectionManager
	pubsub?: PubSub
}

export interface GossipLogInit {
	location?: string | null
	sync?: boolean
}

export type GossipLogEvents = {
	sync: CustomEvent<{ topic: string; peerId: PeerId; successCount: number; failureCount: number }>
	commit: CustomEvent<{ topic: string; root: Node }>
	message: CustomEvent<{
		topic: string
		id: string
		signature: Signature | null
		message: Message
		result: void | IPLDValue
	}>
}

export interface TopicInit<Payload, Result> extends SyncOptions {
	topic: string
	apply: (id: string, signature: Signature | null, message: Message<Payload>) => Awaitable<Result>
	validate: (payload: unknown) => payload is Payload

	signatures?: boolean
	sequencing?: boolean
	replay?: boolean // TODO
}

function extractGossipSub(components: GossipLogComponents): GossipSub {
	const { pubsub } = components
	assert(pubsub !== undefined, "pubsub service not found")
	assert(pubsub instanceof GossipSub)
	return pubsub
}

export class GossipLog extends EventEmitter<GossipLogEvents> implements Startable {
	public readonly location: string | null

	private readonly sync: boolean
	private readonly log = logger(`canvas:gossiplog`)

	#started = false

	#messages = new Map<string, AbstractMessageLog<unknown, unknown>>()
	#services = new Map<string, SyncService<unknown, unknown>>()
	#pubsub: GossipSub

	constructor(private readonly components: GossipLogComponents, init: GossipLogInit) {
		super()
		this.location = init.location ?? null
		this.sync = init.sync ?? true
		this.#pubsub = extractGossipSub(components)
	}

	public isStarted() {
		return this.#started
	}

	public async start() {
		this.log("starting")
		this.#pubsub.addEventListener("message", this.handleMessage)
		this.#started = true
	}

	public async afterStart() {
		for (const service of this.#services.values()) {
			await service.start()
		}
	}

	public async beforeStop() {
		await Promise.all(
			Array.from(this.#services).map(async ([topic, service]) => {
				await service.stop()
				this.#services.delete(topic)
			})
		)
	}

	public async stop() {
		this.log("stopping")
		this.#pubsub.removeEventListener("message", this.handleMessage)

		for (const messages of this.#messages.values()) {
			await messages.close()
		}

		this.#messages.clear()
		this.#services.clear()
		this.#started = false
	}

	public async subscribe<Payload, Result>(init: TopicInit<Payload, Result>): Promise<void> {
		const { topic, validate, apply, signatures, sequencing, ...syncOptions } = init
		assert(nsidPattern.test(topic), "invalid topic (must match [a-zA-Z0-9\\.\\-]+)")
		this.log("subscribing to %s", topic)

		const messages = await openMessageLog({ location: this.location, topic, apply, validate, signatures, sequencing })
		this.#messages.set(topic, messages as AbstractMessageLog<unknown, unknown>)

		if (this.sync) {
			const service = new SyncService(this.components, messages, syncOptions)
			this.#services.set(topic, service as SyncService<unknown, unknown>)
			service.addEventListener("sync", ({ detail }) => this.safeDispatchEvent("sync", { detail }))
			// service.addEventListener("sync", (event) => this.dispatchEvent(event))

			if (this.#started) {
				await service.start()
			}
		}

		if (this.#started) {
			this.#pubsub.subscribe(topic)
		}
	}

	public async unsubscribe(topic: string): Promise<void> {
		this.log("unsubscribing from %s", topic)

		if (this.#started) {
			this.#pubsub.unsubscribe(topic)
		}

		const service = this.#services.get(topic)
		if (service !== undefined) {
			await service.stop().finally(() => this.#services.delete(topic))
		}

		const messages = this.#messages.get(topic)
		if (messages !== undefined) {
			await messages.close().finally(() => this.#messages.delete(topic))
		}
	}

	public async publish<Payload, Result>(
		topic: string,
		payload: Payload,
		options: { signer?: MessageSigner<Payload> } = {}
	) {
		const messages = this.#messages.get(topic) as AbstractMessageLog<Payload, Result> | undefined
		assert(messages !== undefined, "no subscription for topic")
		const { id, value, result } = await messages.append(payload, options)

		if (this.#started) {
			const recipients = this.#pubsub.publish(topic, value).then(
				({ recipients }) => {
					this.log("published message %s to %d recipients %O", id, recipients.length, recipients)
					return recipients
				},
				(err) => {
					this.log.error("failed to publish event: %O", err)
					return []
				}
			)

			return { id, result, recipients }
		} else {
			return { id, result, recipients: Promise.resolve([]) }
		}
	}

	private handleMessage = async ({ detail: msg }: CustomEvent<PubSubMessage>) => {
		const { topic, data } = msg

		const messages = this.#messages.get(topic)
		if (messages === undefined) {
			return
		}

		const [key, signature, message] = messages.decode(data)
		const id = base32.baseEncode(key)

		this.log("received message %s via gossipsub", id)

		// TODO: check if the message's parents exist, and mempool the message if any don't.

		const { result, root } = await messages.insert(signature, message)
		this.log("applied message %s and got result %o", id, result)
		this.log("committed new root %s", bytesToHex(root.hash))
		// this.dispatchEvent(new CustomEvent("commit", { detail: { topic, root } }))
		// this.dispatchEvent(new CustomEvent("message", { detail: { topic, id, signature, message, result } }))
	}
}

export const gossiplog = (init: GossipLogInit) => (components: GossipLogComponents) => new GossipLog(components, init)
