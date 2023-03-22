import type { EventEmitter } from "@libp2p/interfaces/events"

import type { Message } from "./messages.js"
import type { ModelValue } from "./models.js"
import type { Chain, ChainId } from "./contracts.js"

export interface CoreEvents {
	close: Event
	update: Event
	message: CustomEvent<Message>
	sync: CustomEvent<{ uri: string; peer: string; time: number; status: "success" | "failure" }>
}

export interface CoreAPI extends EventEmitter<CoreEvents> {
	apply(message: Message): Promise<{ hash: string }>
	getRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
		route: string,
		params?: Record<string, ModelValue>
	): Promise<T[]>
	getApplicationData(): Promise<ApplicationData>
}

export type ApplicationData = {
	cid: string
	uri: string
	appName: string
	peerId: string | null
	actions: string[]
	routes: string[]
	chainImplementations: Partial<Record<Chain, ChainId[]>>
}
