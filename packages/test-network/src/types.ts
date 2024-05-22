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

export type Event =
	| { type: "start"; peerId: string; timestamp: number; detail: { root: string } }
	| { type: "stop"; peerId: string; timestamp: number; detail: {} }
	| {
			type: "connection:open"
			peerId: string
			timestamp: number
			detail: { id: string; remotePeer: string; remoteAddr: string }
	  }
	| {
			type: "connection:close"
			peerId: string
			timestamp: number
			detail: { id: string; remotePeer: string; remoteAddr: string }
	  }
	| { type: "gossipsub:mesh:update"; peerId: string; timestamp: number; detail: { topic: string; peers: string[] } }
	| { type: "gossiplog:commit"; peerId: string; timestamp: number; detail: { topic: string; root: string } }
