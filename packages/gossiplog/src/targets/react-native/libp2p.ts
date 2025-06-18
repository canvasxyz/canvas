import { Libp2p } from "@libp2p/interface"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { NetworkConfig, ServiceMap } from "@canvas-js/gossiplog/libp2p"

export async function getLibp2p<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	config: NetworkConfig,
): Promise<Libp2p<ServiceMap<Payload>>> {
	throw new Error("Unsupported platform")
}
