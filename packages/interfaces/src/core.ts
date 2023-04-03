import type { EventEmitter } from "@libp2p/interfaces/events"

import type { Message } from "./messages.js"
import type { ModelValue } from "./models.js"
import type { Chain, ChainId } from "./contracts.js"

export type SyncEventDetail = { uri: string; peer: string; time: number; status: "success" | "failure" }
export type UpdateEventDetail = { uri: string; root: string | null }
export type MessageEventDetail = { uri: string; hash: string; message: Message }

export interface CoreEvents {
	close: Event
	message: CustomEvent<MessageEventDetail>
	update: CustomEvent<UpdateEventDetail>
	sync: CustomEvent<SyncEventDetail>
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
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
	chains: Partial<Record<Chain, ChainId[]>>
	peers: { id: string; protocols?: string[]; addresses?: string[] }[]
	merkleRoots: Record<string, string>
}
