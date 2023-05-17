import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { KadDHT } from "@libp2p/kad-dht"
import type { FetchService } from "libp2p/fetch"
import type { PingService } from "libp2p/ping"

export interface P2PConfig {
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export type ServiceMap = {
	pubsub: PubSub<GossipsubEvents>
	dht: KadDHT
	fetchService: FetchService
	pingService: PingService
	identifyService: {}
}
