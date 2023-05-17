export type KeyBundle = {
	signingAddress: `0x${string}`
	encryptionPublicKey: string
}

export interface UserRegistration {
	privateKey: `0x${string}`
	publicKeyBundle: KeyBundle
	publicKeyBundleSignature: `0x${string}`
}

export type Room = {
	members: string[]
	sharedKey: string[]
	sharedKeyHash: string
}

export type User = {
	address: string
}
