import { AbstractStore, StoreInit } from "../AbstractStore.js"

export { AbstractStore, StoreInit as GraphStoreInit, Graph } from "../AbstractStore.js"

export async function openStore(init: StoreInit): Promise<AbstractStore> {
	throw new Error("unsupported platform")
}
