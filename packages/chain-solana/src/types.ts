export type SolanaSessionData = {
	signature: Uint8Array
}

export type SolanaMessage = {
	publicKey: string
	issuedAt: string
	expirationTime: string | null
}
