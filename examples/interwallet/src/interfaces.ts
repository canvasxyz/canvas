export type KeyBundle = {
	signingPublicKey: `0x${string}`
	encryptionPublicKey: `0x${string}`
}

export interface PublicUserRegistration {
	walletName: string
	address: `0x${string}`
	keyBundle: KeyBundle
	keyBundleSignature: `0x${string}`
}

export interface PrivateUserRegistration extends PublicUserRegistration {
	privateKey: `0x${string}`
}

export type WalletName = "metamask" | "walletconnect"
