type Signed<T> = { signature: string; payload: T }

export type KeyBundle = {
	signingAddress: string
	encryptionPublicKey: string
}
export type UserRegistration = Signed<KeyBundle>
