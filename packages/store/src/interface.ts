import type { EventEmitter } from "@libp2p/interfaces/events"
import type { Libp2p } from "@libp2p/interface-libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { CID } from "multiformats/cid"
import type { Node } from "@canvas-js/okra-node"

export type IPLDValue = IPLDPrimitive | IPLDArray | IPLDObject
export type IPLDPrimitive = null | boolean | number | string | Uint8Array | CID
export interface IPLDArray extends Array<IPLDValue> {}
export interface IPLDObject {
	[key: string]: IPLDValue
}

export type Awaitable<T> = T | Promise<T>

export type StoreEvents = {
	sync: CustomEvent<{ root: Node; peerId: PeerId; successCount: number; failureCount: number }>
}

export interface Store<T extends IPLDValue = IPLDValue> extends EventEmitter<StoreEvents> {
	libp2p: Libp2p<{ pubsub: PubSub }>

	start(): Promise<void>
	stop(): Promise<void>

	publish(event: T): Promise<{ key: Uint8Array; result?: IPLDValue; recipients: number }>
	get(key: Uint8Array): Promise<T | null>
}

export interface StoreInit<T> extends StoreOptions {
	topic: string
	libp2p: Libp2p<{ pubsub: PubSub }>
	encoding?: Encoding<T>
	apply: (key: Uint8Array, event: T) => Awaitable<{ result?: IPLDValue }>
}

export interface StoreOptions {
	replay?: boolean
	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export interface Encoding<T> {
	keyToString: (key: Uint8Array) => string
	encode: (event: T) => [key: Uint8Array, value: Uint8Array]
	decode: (value: Uint8Array) => [key: Uint8Array, event: T]
}
