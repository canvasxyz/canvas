import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { Identify } from "@libp2p/identify"
import type { PeerId, PubSub } from "@libp2p/interface"
import type { KadDHT } from "@libp2p/kad-dht"
import type { PingService } from "@libp2p/ping"

import type { Registry } from "prom-client"

import type { SyncSource, Awaitable } from "@canvas-js/okra"

export interface Snapshot extends SyncSource {
	getValues(keys: Uint8Array[]): Awaitable<Uint8Array[]>
}

export type ServiceMap = {
	identify: Identify
	ping: PingService
	pubsub?: PubSub<GossipsubEvents>
	dht?: KadDHT
}

export interface NetworkConfig {
	start?: boolean
	peerId?: PeerId

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]

	minConnections?: number
	maxConnections?: number

	registry?: Registry
}
