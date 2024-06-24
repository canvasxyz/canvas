import type { GossipLogService } from "@canvas-js/gossiplog/service"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { Identify } from "@libp2p/identify"
import type { PubSub } from "@libp2p/interface"
import type { KadDHT } from "@libp2p/kad-dht"
import type { PingService } from "@libp2p/ping"

export type ServiceMap<Payload> = {
	identify: Identify
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService<Payload>
	ping: PingService
	dht?: KadDHT
}
