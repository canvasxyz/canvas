import { logger } from "@libp2p/logger"

import { SignedDiscoveryRecord } from "#protocols/discovery"

import { DiscoveryRecordCache } from "./index.js"
import { minute } from "../constants.js"
import { CacheMap } from "../utils.js"

type CacheRecord = { time: number; record: SignedDiscoveryRecord }

export class MemoryCache implements DiscoveryRecordCache {
	private static TTL = 10 * minute
	private static GC_INTERVAL = 1 * minute
	private static TOPIC_LIMIT = 128
	private static TOPIC_PEER_LIMIT = 64

	private readonly topicMap = new CacheMap<string, CacheMap<string, CacheRecord>>(MemoryCache.TOPIC_LIMIT)

	private readonly log = logger("canvas:store:cache")

	constructor(signal?: AbortSignal) {
		const timer = setInterval(() => {
			this.log("staring gc sweep")

			const now = performance.now()
			for (const [topic, peerMap] of this.topicMap) {
				for (const [id, { time }] of peerMap) {
					if (time + MemoryCache.TTL < now) {
						this.log("evicting peer %s in topic %s", id, topic)
						peerMap.delete(id)
					}
				}

				if (peerMap.size === 0) {
					this.topicMap.delete(topic)
				}
			}

			this.log("finished gc sweep")
		}, MemoryCache.GC_INTERVAL)

		signal?.addEventListener("abort", () => clearInterval(timer))
	}

	public insert(topics: string[], record: SignedDiscoveryRecord) {
		const time = performance.now()
		const id = record.from.toString()
		for (const topic of topics) {
			const peerMap = this.topicMap.get(topic)
			if (peerMap === undefined) {
				this.topicMap.set(topic, new CacheMap(MemoryCache.TOPIC_PEER_LIMIT, [[id, { time, record }]]))
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
