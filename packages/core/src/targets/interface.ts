import type { PeerId } from "@libp2p/interface-peer-id"
import type { Libp2pOptions } from "libp2p"

import type { AbstractModelDB, ModelsInit, Resolve } from "@canvas-js/modeldb-interface"
import { Store, StoreInit } from "@canvas-js/store"

import type { ServiceMap } from "../libp2p.js"
import { IPLDValue } from "@canvas-js/interfaces"

export interface PlatformTarget {
	getPeerId(): Promise<PeerId>
	openDB(name: string, models: ModelsInit, options: { resolve: Resolve }): Promise<AbstractModelDB>
	openStore<T extends IPLDValue>(init: StoreInit<T>): Promise<Store>
	extendLibp2pOptions(options: Libp2pOptions<ServiceMap>): Libp2pOptions<ServiceMap>
}
