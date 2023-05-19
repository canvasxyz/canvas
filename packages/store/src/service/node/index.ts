import * as okra from "@canvas-js/okra-node"

import { StoreService, StoreInit, StoreComponents } from "../service.js"

export type { StoreService, StoreInit, StoreComponents } from "../service.js"

export function storeService(path: string, init: StoreInit): (components: StoreComponents) => StoreService {
	const tree = new okra.Tree(path)
	return (components) =>
		new StoreService(components, init, {
			read: async (targetPeerId, callback) => tree.read(callback),
			write: async (sourcePeerId, callback) => tree.write(callback),
			close: () => tree.close(),
		})
}
