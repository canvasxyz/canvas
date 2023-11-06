export type SolanaSessionData = {
	signature: Uint8Array
}

export type SolanaMessage = {
	signingKey: string
	issuedAt: string
	expirationTime: string | null
}
