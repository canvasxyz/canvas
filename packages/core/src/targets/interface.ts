import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import type { AbstractModelDB, ModelsInit, Resolve } from "@canvas-js/modeldb-interface"

import type { ServiceMap } from "../libp2p.js"

export interface PlatformTarget {
	getPeerId(): Promise<PeerId>
	openDB(key: string, models: ModelsInit, options: { resolve: Resolve }): Promise<AbstractModelDB>
	extendLibp2pOptions(options: Libp2pOptions<ServiceMap>): Libp2pOptions<ServiceMap>
}
