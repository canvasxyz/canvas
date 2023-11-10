export type SolanaSessionData = {
	signature: Uint8Array
}

export type SolanaMessage = {
	topic: string
	publicKey: string
	issuedAt: string
	expirationTime: string | null
}
