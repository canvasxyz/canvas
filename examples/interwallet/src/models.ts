type Signed<T> = { signature: string; payload: T }

export type KeyBundle = {
	signingAddress: string
	encryptionPublicKey: string
}
export type UserRegistration = Signed<KeyBundle>

export interface AbstractStore {
	insert(key: Uint8Array, value: Uint8Array): Promise<void>
	close(): Promise<void>
}

export type Room = {
	members: string[]
	sharedKey: string[]
	sharedKeyHash: string
}
