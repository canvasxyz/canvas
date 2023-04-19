import { EventEmitter } from "@libp2p/interfaces/events"
import type { Message, Session, UpdateEventDetail } from "@canvas-js/interfaces"

export type Node = { level: number; key: Uint8Array | null; hash: Uint8Array; id?: Uint8Array }

export interface ReadOnlyTransaction {
	readonly uri: string

	getMessage(id: Uint8Array): Promise<Message | null>
	getSessionByAddress(chain: string, address: string): Promise<[hash: string | null, session: Session | null]>

	getRoot(): Promise<Node>
	getNode(level: number, key: Uint8Array | null): Promise<Node>
	getChildren(level: number, key: Uint8Array | null): Promise<Node[]>
	seek(level: number, key: Uint8Array | null): Promise<Node | null>
}

export interface ReadWriteTransaction extends ReadOnlyTransaction {
	insertMessage(id: Uint8Array, message: Message): Promise<void>
}

export interface MessageStoreEvents {
	update: CustomEvent<UpdateEventDetail>
}

export interface MessageStore extends EventEmitter<MessageStoreEvents> {
	getMessageStream(filter?: {
		type?: Message["type"]
		limit?: number
		app?: string
	}): AsyncIterable<[Uint8Array, Message]>

	close(): Promise<void>

	read<T = void>(callback: (txn: ReadOnlyTransaction) => T | Promise<T>, options?: { uri?: string }): Promise<T>
	write<T = void>(callback: (txn: ReadWriteTransaction) => T | Promise<T>, options?: { uri?: string }): Promise<T>

	getMerkleRoots(): Record<string, string>
}
