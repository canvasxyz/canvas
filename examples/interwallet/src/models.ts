type Signed<T> = { signature: `0x${string}`; payload: T }

export interface AbstractStore {
	insert(key: Uint8Array, value: Uint8Array): Promise<void>
	close(): Promise<void>
}

export type Room = {
	members: string[]
	sharedKey: string[]
	sharedKeyHash: string
}
