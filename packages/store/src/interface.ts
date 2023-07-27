import { Node } from "@canvas-js/okra-node"
import type { Libp2p } from "@libp2p/interface-libp2p"
import { PeerId } from "@libp2p/interface-peer-id"
import type { PubSub } from "@libp2p/interface-pubsub"
import type { EventEmitter } from "@libp2p/interfaces/events"

export type Awaitable<T> = T | Promise<T>

export type Consumer<T> = (key: Uint8Array, event: T) => Awaitable<void>

export type StoreEvents = {
	sync: CustomEvent<{ root: Node; peerId: PeerId; successCount: number; failureCount: number }>
}

export interface Store<T = unknown> extends EventEmitter<StoreEvents> {
	libp2p: Libp2p<{ pubsub: PubSub }>

	start(): Promise<void>
	stop(): Promise<void>

	attach(consumer: Consumer<T>, options?: { replay?: boolean }): void
	detach(consumer: Consumer<T>): void

	publish(event: T): Promise<{ key: Uint8Array; recipients: number }>
	get(key: Uint8Array): Promise<T | null>
}

export interface Codec<T> {
	keyToString: (key: Uint8Array) => string
	encode: (event: T) => [key: Uint8Array, value: Uint8Array]
	decode: (value: Uint8Array) => [key: Uint8Array, event: T]
}

export interface StoreOptions {
	minConnections?: number
	maxConnections?: number
	maxInboundStreams?: number
	maxOutboundStreams?: number
}

export interface StoreInit<T> extends StoreOptions {
	libp2p: Libp2p<{ pubsub: PubSub }>
	topic: string
	codec?: Codec<T>
}
