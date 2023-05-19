import * as okra from "@canvas-js/okra-node"

import { StoreService, StoreInit, StoreComponents } from "../service.js"

export type { StoreService, StoreInit, StoreComponents } from "../service.js"

export function storeService(init: StoreInit): (components: StoreComponents) => StoreService {
	return (components) => new StoreService(components, init, new okra.Tree(init.location))
}
