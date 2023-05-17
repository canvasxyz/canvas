export type KeyBundle = {
	signingAddress: `0x${string}`
	encryptionPublicKey: string
}

export interface UserRegistration {
	privateKey: `0x${string}`
	publicKeyBundle: KeyBundle
	publicKeyBundleSignature: `0x${string}`
}
