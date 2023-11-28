import type { PeerId } from "@libp2p/interface/peer-id"
import { peerIdFromString } from "@libp2p/peer-id"
import { logger } from "@libp2p/logger"

import { CacheMap } from "../utils.js"
import { TopicCache } from "./interface.js"

export class MemoryCache implements TopicCache {
	private readonly log = logger("canvas:discovery:cache")

	#cache = new CacheMap<string, CacheMap<string, { timestamp: number }>>(this.maxTopics)
	#peerRecords = new CacheMap<string, { peerRecordEnvelope: Uint8Array; timestamp: number }>(this.maxPeers)

	public constructor(private readonly maxTopics = 100, private readonly maxPeers = 100) {}

	public observe(topic: string, peerId: PeerId): void {
		this.log("observing peer %p on topic %s", peerId, topic)
		const peers = this.#cache.get(topic)
		if (peers !== undefined) {
			peers.set(peerId.toString(), { timestamp: performance.now() })
		} else {
			this.#cache.set(topic, new CacheMap(this.maxPeers, [[peerId.toString(), { timestamp: performance.now() }]]))
		}
	}

	public identify(peerId: PeerId, peerRecordEnvelope: Uint8Array): void {
		this.#peerRecords.set(peerId.toString(), { peerRecordEnvelope, timestamp: performance.now() })
	}

	public query(topic: string): { peerId: PeerId; peerRecordEnvelope: Uint8Array }[] {
		this.log("querying for peers on topic %s", topic)

		const peers = this.#cache.get(topic)
		if (peers === undefined) {
			return []
		}

		const records = Array.from(peers)
		records.sort(([{}, { timestamp: a }], [{}, { timestamp: b }]) => (a < b ? 1 : b < a ? -1 : 0))

		const results: { peerId: PeerId; peerRecordEnvelope: Uint8Array }[] = []
		for (const [peerId] of records) {
			const { peerRecordEnvelope } = this.#peerRecords.get(peerId) ?? {}
			if (peerRecordEnvelope !== undefined) {
				results.push({ peerId: peerIdFromString(peerId), peerRecordEnvelope })
			}
		}

		return results.slice(0, 5)
	}
}
