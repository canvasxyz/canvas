import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import type { AbstractModelDB, ModelsInit, Resolve } from "@canvas-js/modeldb-interface"
import { AbstractStore, StoreInit, IPLDValue } from "@canvas-js/store"

import type { ServiceMap } from "../libp2p.js"

export interface PlatformTarget {
	getPeerId(): Promise<PeerId>
	openDB(name: string, models: ModelsInit, options: { resolve: Resolve }): Promise<AbstractModelDB>
	openStore<T extends IPLDValue>(init: StoreInit<T>): Promise<AbstractStore<T>>
	extendLibp2pOptions(options: Libp2pOptions<ServiceMap>): Libp2pOptions<ServiceMap>
}
