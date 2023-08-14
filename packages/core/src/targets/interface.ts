import type { PeerId } from "@libp2p/interface-peer-id"

import type { AbstractModelDB, ModelsInit, Resolve } from "@canvas-js/modeldb-interface"

export interface PlatformTarget {
	getPeerId(): Promise<PeerId>
	openDB(name: string, models: ModelsInit, options: { resolve: Resolve }): Promise<AbstractModelDB>
}
