import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb-interface"
import type { PeerId } from "@libp2p/interface-peer-id"

export interface PlatformTarget {
	getPeerId(): Promise<PeerId>
	openDB(
		name: string,
		models: ModelsInit,
		options: { resolve: (versionA: string, versionB: string) => string }
	): Promise<AbstractModelDB>
}
