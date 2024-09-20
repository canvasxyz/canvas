import * as cbor from "@ipld/dag-cbor"
import {
	PeerId,
	Startable,
	Logger,
	TypedEventTarget,
	Libp2pEvents,
	PeerStore,
	PubSub,
	TopicValidatorResult,
} from "@libp2p/interface"
import { AddressManager, Registrar } from "@libp2p/interface-internal"

import { logger } from "@libp2p/logger"
import { peerIdFromBytes } from "@libp2p/peer-id"
import { multiaddr } from "@multiformats/multiaddr"
import { GossipSub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record"

import { assert } from "@canvas-js/utils"

import { DiscoveryRecord } from "./interface.js"

export type GossipDiscoveryServiceComponents = {
	addressManager: AddressManager
	registrar: Registrar
	events: TypedEventTarget<Libp2pEvents>
	peerId: PeerId
	peerStore: PeerStore
	pubsub: PubSub
}

export interface GossipDiscoveryServiceInit {}

export class GossipDiscoveryService implements Startable {
	private static extractGossipSub(components: GossipDiscoveryServiceComponents): GossipSub {
		const pubsub = components.pubsub
		assert(pubsub instanceof GossipSub, "expected pubsub instanceof GossipSub")
		return pubsub
	}

	public static discoveryTopic = "canvas/discovery"

	public readonly pubsub: GossipSub
	private readonly log: Logger

	#started: boolean = false
	#interval: NodeJS.Timeout | null = null

	constructor(private readonly components: GossipDiscoveryServiceComponents, init: GossipDiscoveryServiceInit) {
		this.log = logger(`canvas:discovery:pubsub`)
		this.pubsub = GossipDiscoveryService.extractGossipSub(components)
	}

	private handleGossipsubMessage = async ({
		detail: { msgId, propagationSource, msg },
	}: GossipsubEvents["gossipsub:message"]) => {
		if (msg.topic !== GossipDiscoveryService.discoveryTopic) {
			return
		}

		try {
			const { id, addresses, protocols, peerRecordEnvelope } = cbor.decode<DiscoveryRecord>(msg.data)
			const peerId = peerIdFromBytes(id)
			this.log("received heartbeat from %p", peerId)

			await this.components.peerStore.patch(peerIdFromBytes(id), {
				addresses: addresses.map((addr) => ({ isCertified: false, multiaddr: multiaddr(addr) })),
				protocols: protocols,
				peerRecordEnvelope: peerRecordEnvelope ?? undefined,
			})

			this.pubsub.reportMessageValidationResult(msgId, propagationSource.toString(), TopicValidatorResult.Accept)
		} catch (err) {
			this.pubsub.reportMessageValidationResult(msgId, propagationSource.toString(), TopicValidatorResult.Reject)
			this.log.error(err)
		}
	}

	public isStarted() {
		return this.#started
	}

	public beforeStart() {
		this.log("beforeStart")
		this.pubsub.addEventListener("gossipsub:message", this.handleGossipsubMessage)
	}

	public async start() {
		this.log("start")
		this.#started = true
	}

	public async afterStart() {
		this.log("afterStart")
		this.components.pubsub.subscribe(GossipDiscoveryService.discoveryTopic)
		this.#interval = setInterval(async () => {
			const multiaddrs = this.components.addressManager.getAnnounceAddrs()
			const record = new PeerRecord({ peerId: this.components.peerId, multiaddrs })

			const envelope = await RecordEnvelope.seal(record, this.components.peerId)
			const peerRecordEnvelope = envelope.marshal()

			const id = this.components.peerId.toBytes()
			const addresses = multiaddrs.map((addr) => addr.bytes)
			const protocols = this.components.registrar.getProtocols()
			this.components.pubsub
				.publish(GossipDiscoveryService.discoveryTopic, cbor.encode({ id, addresses, protocols, peerRecordEnvelope }))
				.then((result) => this.log("published heartbead to %d recipients", result.recipients.length))
		}, 3 * 1000)
	}

	public async beforeStop() {
		this.log("beforeStop")

		if (this.#interval !== null) {
			clearInterval(this.#interval)
			this.#interval = null
		}
	}

	public async stop() {
		this.log("stop")
		this.#started = false
	}

	public afterStop(): void {}
}

export const gossipDiscovery =
	(init: GossipDiscoveryServiceInit = {}) =>
	(components: GossipDiscoveryServiceComponents) =>
		new GossipDiscoveryService(components, init)
