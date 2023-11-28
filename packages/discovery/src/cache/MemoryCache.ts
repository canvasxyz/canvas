import type { PeerId } from "@libp2p/interface/peer-id"
import { peerIdFromString } from "@libp2p/peer-id"
import { logger } from "@libp2p/logger"

import { CacheMap } from "../utils.js"
import { TopicCache } from "./interface.js"

export class MemoryCache implements TopicCache {
	private readonly log = logger("canvas:discovery:cache")

	#cache = new CacheMap<string, CacheMap<string, null>>(this.maxTopics)
	#peerRecords = new CacheMap<string, Uint8Array>(this.maxPeers)

	public constructor(private readonly maxTopics = 100, private readonly maxPeers = 100) {}

	public observe(topic: string, peerId: PeerId): void {
		this.log("observing peer %p on topic %s", peerId, topic)
		const peers = this.#cache.get(topic)
		if (peers !== undefined) {
			peers.set(peerId.toString(), null)
		} else {
			this.#cache.set(topic, new CacheMap(this.maxPeers, [[peerId.toString(), null]]))
		}
	}

	public identify(peerId: PeerId, peerRecordEnvelope: Uint8Array): void {
		this.#peerRecords.set(peerId.toString(), peerRecordEnvelope)
	}

	public query(topic: string): { peerId: PeerId; peerRecordEnvelope?: Uint8Array }[] {
		this.log("querying for peers on topic %s", topic)

		const results: { peerId: PeerId; peerRecordEnvelope?: Uint8Array }[] = []
		for (const [peerId] of this.#cache.get(topic) ?? []) {
			const peerRecordEnvelope = this.#peerRecords.get(peerId)
			results.push({ peerId: peerIdFromString(peerId), peerRecordEnvelope })
		}

		return results
	}
}
