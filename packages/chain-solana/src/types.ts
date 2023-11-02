export type SolanaSessionData = {
	signature: Uint8Array
}

// TODO: Which fields do we actually need?
export type SolanaMessage = {
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}
