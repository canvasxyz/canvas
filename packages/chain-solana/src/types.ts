export type SolanaSessionData = {
	signature: Uint8Array
}

export type SolanaMessage = {
	address: string
	signingKey: string
	issuedAt: string
	expirationTime: string | null
}
