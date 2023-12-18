export type EIP712VerifiableSessionData = {
	signature: Uint8Array
}

export type EIP712VerifiableSessionMessage = {
	version: string
	address: string
	// TODO: what needs to go here?
}
