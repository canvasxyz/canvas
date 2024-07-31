import * as cbor from "@ipld/dag-cbor"
import { PeerId, Startable, Logger, TypedEventTarget, Libp2pEvents, PeerUpdate, PeerStore } from "@libp2p/interface"
import { Fetch } from "@libp2p/fetch"
import { logger } from "@libp2p/logger"
import { peerIdFromBytes, peerIdFromString } from "@libp2p/peer-id"
import { multiaddr } from "@multiformats/multiaddr"

import { shuffle } from "./utils.js"

export type DiscoveryServiceComponents = {
	events: TypedEventTarget<Libp2pEvents>
	peerId: PeerId
	peerStore: PeerStore
	fetch: Fetch
}

export interface DiscoveryServiceInit {
	resultLimit?: number
}

type DiscoveryRecord = {
	id: Uint8Array
	addresses: Uint8Array[]
	protocols: string[]
	peerRecordEnvelope: Uint8Array | null
}

export class DiscoveryService implements Startable {
	public static protocolPrefix = "/canvas/v1/"

	/** peerId -> Set<topic> */
	public readonly topicMap = new Map<string, Set<string>>()

	/** topic -> Set<peerId> */
	public readonly topicIndex = new Map<string, Set<string>>()

	private readonly log: Logger
	private readonly resultLimit: number

	#started: boolean = false

	constructor(private readonly components: DiscoveryServiceComponents, init: DiscoveryServiceInit) {
		this.log = logger(`canvas:discovery:service`)
		this.resultLimit = init.resultLimit ?? 16
	}

	public async fetch(peerId: PeerId, topic: string): Promise<PeerId[]> {
		const key = `topic/${topic}`
		this.log("fetch %p %s", peerId, key)

		const result = await this.components.fetch.fetch(peerId, key)
		if (result === undefined) {
			return []
		}

		const results = cbor.decode<DiscoveryRecord[]>(result)

		const peers: PeerId[] = []
		for (const { id, addresses, protocols, peerRecordEnvelope } of results) {
			const peerId = peerIdFromBytes(id)
			if (peerId.equals(this.components.peerId)) {
				continue
			}

			await this.components.peerStore.merge(peerId, {
				addresses: addresses.map((addr) => ({ isCertified: true, multiaddr: multiaddr(addr) })),
				protocols: protocols,
				peerRecordEnvelope: peerRecordEnvelope ?? undefined,
			})

			peers.push(peerId)
		}

		this.log("fetch %p %s -> %d new peers", peerId, key, peers.length)

		return peers
	}

	public isStarted() {
		return this.#started
	}

	public beforeStart() {
		this.components.events.addEventListener("peer:disconnect", this.handlePeerDisconnect)
		this.components.events.addEventListener("peer:update", this.handlePeerUpdate)

		this.components.fetch.registerLookupFunction("topic/", async (key) => {
			const [_, topic] = key.split("/")

			const records: DiscoveryRecord[] = []

			const peers = Array.from(this.topicIndex.get(topic) ?? [])
			shuffle(peers)

			for (const peerId of peers.slice(0, this.resultLimit)) {
				const id = peerIdFromString(peerId)
				const peer = await this.components.peerStore.get(id)
				const addresses = peer.addresses.map(({ multiaddr }) => multiaddr.bytes)

				// TODO: filter for public addresses?
				// TODO: filter for peerRecordEnvelope?

				records.push({
					id: id.toBytes(),
					addresses: addresses,
					protocols: peer.protocols,
					peerRecordEnvelope: peer.peerRecordEnvelope ?? null,
				})

				if (records.length < this.resultLimit) {
					continue
				} else {
					break
				}
			}

			this.log("handling fetch: %s (%d results)", key, records.length)
			return cbor.encode(records)
		})
	}

	public async start() {
		this.log("start")
		this.#started = true
	}

	public async afterStart() {
		this.log("afterStart")
	}

	public async beforeStop() {
		this.log("beforeStop")
	}

	public async stop() {
		this.log("stop")
		this.topicMap.clear()
		this.topicIndex.clear()
		this.#started = false
	}

	public afterStop(): void {
		this.components.events.removeEventListener("peer:update", this.handlePeerUpdate)
		this.components.events.removeEventListener("peer:disconnect", this.handlePeerDisconnect)
	}

	private handlePeerDisconnect = ({ detail: peerId }: CustomEvent<PeerId>) => {
		this.log(`peer:disconnect ${peerId}`)

		for (const topic of this.topicMap.get(peerId.toString()) ?? []) {
			this.topicMap.delete(peerId.toString())

			const peers = this.topicIndex.get(topic)
			peers?.delete(peerId.toString())
			if (peers?.size === 0) {
				this.topicIndex.delete(topic)
			}
		}
	}

	private handlePeerUpdate = ({ detail: { peer, previous } }: CustomEvent<PeerUpdate>) => {
		this.log("peer:update %p %o", peer.id, peer.protocols)

		const topics = new Set(
			peer.protocols
				.filter((protocol) => protocol.startsWith(DiscoveryService.protocolPrefix))
				.map((protocol) => protocol.slice(DiscoveryService.protocolPrefix.length, protocol.lastIndexOf("/"))),
		)

		this.topicMap.set(peer.id.toString(), topics)

		const previousTopics = previous?.protocols
			.filter((protocol) => protocol.startsWith(DiscoveryService.protocolPrefix))
			.map((protocol) => protocol.slice(DiscoveryService.protocolPrefix.length))

		for (const topic of previousTopics ?? []) {
			this.topicIndex.get(topic)?.delete(peer.id.toString())
		}

		for (const topic of topics) {
			let peers = this.topicIndex.get(topic)
			if (peers === undefined) {
				peers = new Set()
				this.topicIndex.set(topic, peers)
			}

			peers.add(peer.id.toString())
		}
	}
}

export const discovery =
	(init: DiscoveryServiceInit = {}) =>
	(components: DiscoveryServiceComponents) =>
		new DiscoveryService(components, init)
