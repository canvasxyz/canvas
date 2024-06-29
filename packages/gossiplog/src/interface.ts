import type { GossipLogService } from "@canvas-js/gossiplog/service"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { Identify } from "@libp2p/identify"
import type { PeerId, PubSub } from "@libp2p/interface"
import type { KadDHT } from "@libp2p/kad-dht"
import type { PingService } from "@libp2p/ping"
import type { Fetch } from "@libp2p/fetch"

import type { SyncSource, Awaitable } from "@canvas-js/okra"

export interface SyncServer extends SyncSource {
	getValues(keys: Uint8Array[]): Awaitable<Uint8Array[]>
}

export type ServiceMap<Payload> = {
	identify: Identify
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLogService<Payload>
	ping: PingService
	fetch: Fetch
	dht?: KadDHT
}

export interface NetworkConfig {
	start?: boolean

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	relayServer?: string
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
	peerId?: PeerId
}
