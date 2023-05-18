export interface AbstractStore {
	insert(key: Uint8Array, value: Uint8Array): Promise<void>
	close(): Promise<void>
}
