import type { Libp2p, Libp2pOptions } from "libp2p"
import type { PingService } from "libp2p/ping"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface/pubsub"
import type { GossipsubEvents } from "@chainsafe/libp2p-gossipsub"
import type { GossipLog } from "@canvas-js/gossiplog"

import type { AbstractModelDB, ModelsInit, Resolver } from "@canvas-js/modeldb"
import type { AbstractMessageLog, MessageLogInit } from "@canvas-js/gossiplog"

import type { CanvasConfig } from "../Canvas.js"

export interface PlatformTarget {
	getPeerId: () => Promise<PeerId>
	extendLibp2pOptions?: (options: Libp2pOptions<ServiceMap>) => Libp2pOptions<ServiceMap>

	openDB: (name: string, models: ModelsInit, options?: { resolver: Resolver }) => Promise<AbstractModelDB>
	openMessageLog: <Payload, Result>(
		init: MessageLogInit<Payload, Result>
	) => Promise<AbstractMessageLog<Payload, Result>>

	createLibp2p: (config: CanvasConfig, peerId: PeerId) => Promise<Libp2p<ServiceMap>>
}

export type ServiceMap = {
	identifyService: {}
	pingService: PingService
	pubsub: PubSub<GossipsubEvents>
	gossiplog: GossipLog
}
