import { AbstractGraphStore, GraphStoreInit } from "../AbstractGraphStore.js"

export async function openStore(init: GraphStoreInit): Promise<AbstractGraphStore> {
	throw new Error("unsupported platform")
}
