import type { MultiaddrConnection, PrivateKey, PubSub } from "@libp2p/interface"
import type { Identify } from "@libp2p/identify"
import type { KadDHT } from "@libp2p/kad-dht"
import type { Ping } from "@libp2p/ping"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
export type { GossipSub } from "@chainsafe/libp2p-gossipsub"
import type { Multiaddr } from "@multiformats/multiaddr"
import type { Registry } from "prom-client"

import type { RendezvousClient } from "@canvas-js/libp2p-rendezvous/client"

import type { GossipLogService } from "./service.js"

export interface NetworkConfig {
	/** start libp2p on initialization (default: true) */
	start?: boolean
	privateKey?: PrivateKey

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]
	relayServer?: string
	denyDialMultiaddr?(multiaddr: Multiaddr): Promise<boolean> | boolean
	denyInboundConnection?(maConn: MultiaddrConnection): Promise<boolean> | boolean

	inboundConnectionThreshold?: number
	maxIncomingPendingConnections?: number
	maxConnections?: number
	registry?: Registry
}

export type ServiceMap<Payload> = {
	identify: Identify
	ping: Ping
	pubsub: PubSub<GossipsubEvents>
	gossipLog: GossipLogService<Payload>
	dht: KadDHT
	rendezvous: RendezvousClient
}
