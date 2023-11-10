export type NEARMessage = {
	walletAddress: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
	recipient: string
	nonce: string
}

export type NEARSessionData = {
	signature: Uint8Array
	nonce: string
	data: NEARMessage
	publicKey: string
}
