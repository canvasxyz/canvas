import { logger } from "@libp2p/logger"

import { SignedMessage } from "@libp2p/interface-pubsub"

import { CacheMap, minute, shuffle } from "./utils.js"

export interface ServiceRecordCache {
	insert(protocols: string[], msg: SignedMessage): void
	query(protocol: string, options?: { limit?: number }): SignedMessage[]
	stop(): void
}

type CachedRecord = { time: number; record: SignedMessage }

export interface MemoryCacheInit {
	ttl?: number
	gcInterval?: number
	protocolLimit?: number
	protocolPeerLimit?: number
}

export class MemoryCache implements ServiceRecordCache {
	public static TTL = 10 * minute
	public static GC_INTERVAL = 1 * minute
	public static PROTOCOL_LIMIT = 128
	public static PROTOCOL_PEER_LIMIT = 16

	private readonly ttl: number
	private readonly gcInterval: number
	private readonly protocolLimit: number
	private readonly protocolPeerLimit: number

	private readonly log = logger("canvas:discovery:cache")
	private readonly protocolMap: CacheMap<string, CacheMap<string, CachedRecord>>
	private timer: NodeJS.Timeout | null = null

	constructor(init: MemoryCacheInit = {}) {
		this.ttl = init.ttl ?? MemoryCache.TTL
		this.gcInterval = init.gcInterval ?? MemoryCache.GC_INTERVAL
		this.protocolLimit = init.protocolLimit ?? MemoryCache.PROTOCOL_LIMIT
		this.protocolPeerLimit = init.protocolPeerLimit ?? MemoryCache.PROTOCOL_PEER_LIMIT
		this.protocolMap = new CacheMap(this.protocolLimit)
	}

	public start() {
		this.timer = setInterval(() => {
			this.log("staring gc sweep")

			const now = performance.now()
			for (const [protocol, peerMap] of this.protocolMap) {
				for (const [id, { time }] of peerMap) {
					if (time + this.ttl < now) {
						this.log("evicting peer %s in protocol %s", id, protocol)
						peerMap.delete(id)
					}
				}

				if (peerMap.size === 0) {
					this.protocolMap.delete(protocol)
				}
			}

			this.log("finished gc sweep")
		}, this.gcInterval)
	}

	public stop() {
		if (this.timer !== null) {
			clearInterval(this.timer)
			this.timer = null
			this.protocolMap.clear()
		}
	}

	public insert(protocols: string[], record: SignedMessage) {
		const time = performance.now()
		const id = record.from.toString()
		for (const protocol of protocols) {
			const peerMap = this.protocolMap.get(protocol)
			if (peerMap === undefined) {
				this.protocolMap.set(protocol, new CacheMap(this.protocolPeerLimit, [[id, { time, record }]]))
			} else {
				peerMap.set(id, { time, record })
			}
		}
	}

	public query(protocol: string, options: { limit?: number } = {}): SignedMessage[] {
		const limit = options.limit ?? Infinity

		this.log("querying %s (limit %d)", protocol, limit)
		const records: SignedMessage[] = []

		const peerMap = this.protocolMap.get(protocol)
		if (peerMap !== undefined) {
			for (const { record } of peerMap.values()) {
				records.push(record)
			}
		}

		shuffle(records)

		this.log(
			"got %d records: %o",
			records.length,
			records.map((record) => record.from.toString())
		)

		return records.slice(0, limit)
	}
}
