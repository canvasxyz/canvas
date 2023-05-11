import { SignedMessage } from "@libp2p/interface-pubsub"
import { logger } from "@libp2p/logger"

import { SignedDiscoveryRecord } from "#protocols/discovery"

import { DiscoveryRecordCache } from "./index.js"
import { minute } from "../constants.js"

export class MemoryTopicCache implements DiscoveryRecordCache {
	private static TTL = 10 * minute
	private static GC_INTERVAL = 1 * minute

	private readonly topicMap = new Map<string, Map<string, { time: number; record: SignedDiscoveryRecord }>>()
	private readonly log = logger("canvas:store:memory-topic-cache")

	constructor(signal?: AbortSignal) {
		const timer = setInterval(() => {
			this.log("staring gc sweep")

			const now = performance.now()
			for (const [topic, peerMap] of this.topicMap) {
				for (const [id, { time }] of peerMap) {
					if (time + MemoryTopicCache.TTL < now) {
						this.log("evicting peer %s in topic %s", id, topic)
						peerMap.delete(id)
					}
				}

				if (peerMap.size === 0) {
					this.topicMap.delete(topic)
				}
			}

			this.log("finished gc sweet")
		}, MemoryTopicCache.GC_INTERVAL)

		signal?.addEventListener("abort", () => clearInterval(timer))
	}

	public insert(topics: string[], record: SignedDiscoveryRecord) {
		const time = performance.now()
		const id = record.from.toString()
		for (const topic of topics) {
			const peerMap = this.topicMap.get(topic)
			if (peerMap === undefined) {
				this.topicMap.set(topic, new Map([[id, { time, record }]]))
			} else {
				peerMap.set(id, { time, record })
			}
		}
	}

	public query(topic: string): SignedDiscoveryRecord[] {
		const records: SignedDiscoveryRecord[] = []

		const peerMap = this.topicMap.get(topic)
		if (peerMap !== undefined) {
			for (const { record } of peerMap.values()) {
				records.push(record)
			}
		}

		return records
	}
}
