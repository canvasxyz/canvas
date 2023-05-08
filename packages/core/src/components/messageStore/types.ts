import { EventEmitter } from "@libp2p/interfaces/events"
import type { Message, Session, UpdateEventDetail } from "@canvas-js/interfaces"
import type { Source, Target } from "@canvas-js/okra"

export type Key = Uint8Array | null
export type Node = { level: number; key: Key; hash: Uint8Array; value?: Uint8Array }

export interface MessageStoreEvents {
	update: CustomEvent<UpdateEventDetail>
}

export interface ReadOnlyTransaction {
	uri: string
	source: Source
	getMessage(id: Uint8Array): Promise<Message | null>
	getSessionByAddress(chain: string, address: string): Promise<[hash: string | null, session: Session | null]>
}

export interface ReadWriteTransaction {
	uri: string
	target: Target
	getMessage(id: Uint8Array): Promise<Message | null>
	getSessionByAddress(chain: string, address: string): Promise<[hash: string | null, session: Session | null]>
	insertMessage(id: Uint8Array, message: Message): Promise<void>
}

export interface MessageStore extends EventEmitter<MessageStoreEvents> {
	countMessages(type?: Message["type"]): Promise<number>
	getMessageStream(filter?: {
		type?: Message["type"] | undefined
		limit?: number
		offset?: number
		app?: string
	}): AsyncIterable<[Uint8Array, Message]>

	close(): Promise<void>
	read<T = void>(callback: (txn: ReadOnlyTransaction) => T | Promise<T>, options?: { uri?: string }): Promise<T>
	write<T = void>(callback: (txn: ReadWriteTransaction) => T | Promise<T>, options?: { uri?: string }): Promise<T>

	getMerkleRoots(): Record<string, string>
}
