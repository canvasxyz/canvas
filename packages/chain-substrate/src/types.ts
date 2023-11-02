export type SubstrateSessionData = {
	signature: Uint8Array
	data: SubstrateMessage
}

// TODO: Which fields do we actually need?
export type SubstrateMessage = {
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}
