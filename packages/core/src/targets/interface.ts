import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import type { AbstractModelDB, ModelsInit, Resolver } from "@canvas-js/modeldb"
import type { AbstractMessageLog, MessageLogInit } from "@canvas-js/gossiplog"

import type { ServiceMap } from "../libp2p.js"

export interface PlatformTarget {
	getPeerId: () => Promise<PeerId>
	extendLibp2pOptions?: (options: Libp2pOptions<ServiceMap>) => Libp2pOptions<ServiceMap>

	openDB: (name: string, models: ModelsInit, options?: { resolver: Resolver }) => Promise<AbstractModelDB>
	openMessageLog: <Payload, Result>(
		init: MessageLogInit<Payload, Result>
	) => Promise<AbstractMessageLog<Payload, Result>>
}
