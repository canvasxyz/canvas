export type SIWFSessionData = {
	custodyAddress: string
	fid: string
	signature: Uint8Array
	siweUri: string
	siweDomain: string
	siweNonce: string
	siweVersion: string
	siweChainId: number
	siweIssuedAt: string
	siweExpirationTime: string | null
	siweNotBefore: string | null
}

export type SIWFMessage = {
	version: string
	address: string
	chainId: number
	domain: string
	uri: string
	nonce: string
	issuedAt: string
	expirationTime: string | undefined
	notBefore: string | undefined
	requestId: string
	resources: string[]
}
