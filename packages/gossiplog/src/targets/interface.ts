import type { Libp2p } from "@libp2p/interface"
import type { AbstractGossipLog } from "@canvas-js/gossiplog"
import type { ServiceMap, NetworkConfig } from "@canvas-js/gossiplog/libp2p"

export type AbortOptions = { signal?: AbortSignal }

export interface PlatformTarget {
	connect: <Payload>(gossipLog: AbstractGossipLog<Payload>, url: string, options?: AbortOptions) => Promise<void>
	listen: <Payload>(gossipLog: AbstractGossipLog<Payload>, port: number, options?: AbortOptions) => Promise<void>
	startLibp2p: <Payload>(
		gossipLog: AbstractGossipLog<Payload>,
		config: NetworkConfig,
	) => Promise<Libp2p<ServiceMap<Payload>>>
}
