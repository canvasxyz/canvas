export type SolanaSessionData = {
	signature: Uint8Array
}

export type SolanaMessage = {
	chainId: string
	address: string
	topic: string
	publicKey: string
	issuedAt: string
	expirationTime: string | null
}
