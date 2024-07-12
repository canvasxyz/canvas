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
	resources: string[]
}

export type EIP712AuthorizationData = {
	signature: Uint8Array
}

export type EIP712SessionMessage = {
	address: string
	publicKey: string
	blockhash: string | null
	timestamp: number
	duration: number | null
}
