export type KeyBundle = {
	signingAddress: `0x${string}`
	encryptionPublicKey: string
}

export interface UserRegistration {
	privateKey: `0x${string}`
	publicKeyBundle: KeyBundle
	publicKeyBundleSignature: `0x${string}`
}

export type User = {
	address: string
}

export type Event = { type: "message"; sender: string; createdAt: Date; detail: { text: string } }

export type Signed = { signature: string; signingAddress: string; payload: Uint8Array }
export type Encrypted = { toEncryptionKey: string; data: Uint8Array }
