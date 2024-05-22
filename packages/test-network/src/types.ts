import type { GossipLogService } from "@canvas-js/gossiplog/service"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { Identify } from "@libp2p/identify"
import type { PubSub } from "@libp2p/interface"
import type { KadDHT } from "@libp2p/kad-dht"
import type { PingService } from "@libp2p/ping"

export type ServiceMap = {
	identify: Identify
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService<Uint8Array>
	ping: PingService
	dht: KadDHT
}

type EventTypes = {
	start: { root: string }
	stop: {}
	"connection:open": { id: string; remotePeer: string; remoteAddr: string }
	"connection:close": { id: string; remotePeer: string; remoteAddr: string }
	"gossipsub:mesh:update": { topic: string; peers: string[] }
	"gossiplog:commit": { topic: string; root: string }
}

export type Event = {
	[K in keyof EventTypes]: { type: K; peerId: string; timestamp: number; detail: EventTypes[K] }
}[keyof EventTypes]
