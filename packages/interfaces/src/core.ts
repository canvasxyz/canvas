import type { EventEmitter } from "@libp2p/interfaces/events"

import type { ModelValue } from "@canvas-js/modeldb-interface"
import type { IPLDValue } from "./values.js"

export type SyncEventDetail = { uri: string; peer: string; time: number; status: "success" | "failure" }
export type UpdateEventDetail = { uri: string; root: string | null }
export type MessageEventDetail = { uri: string; hash: string; message: IPLDValue }

export interface CoreEvents {
	close: Event
	message: CustomEvent<MessageEventDetail>
	update: CustomEvent<UpdateEventDetail>
	sync: CustomEvent<SyncEventDetail>
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
}

export interface CoreAPI extends EventEmitter<CoreEvents> {
	apply(message: IPLDValue): Promise<{ hash: string }>
	getRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
		route: string,
		params?: Record<string, ModelValue>
	): Promise<T[]>
	getApplicationData(): Promise<ApplicationData>
}

export type ApplicationData = {
	uri: string
	peerId: string | null
	actions: string[]
	models: Record<string, Record<string, string>>
	signers: string[]
	peers: { id: string; protocols?: string[]; addresses?: string[] }[]
	merkleRoots: Record<string, string>
}
