export type SIWESessionData = {
	signature: Uint8Array
	domain: string
	nonce: string
}

export type SIWEMessage = {
	version: string
	address: string
	chainId: number
	domain: string
	uri: string
	nonce: string
	issuedAt: string
	expirationTime: string | null
}
