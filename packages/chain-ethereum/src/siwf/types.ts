/**
 * SIWFSessionData includes everything required to verify a SIWF signature
 * except for the index of active FIDs, and data in the parent session:
 * `did`, `publicKey, `topic`, `context.timestamp`, `context.duration?`
 *
 * Unlike SIWESigner, the Farcaster `nonce` is generated from the data in this message:
 * - Nonces without blockhash: nonce = `canvas:${topic}:${canvasNonce = crypto.randomBytes(64).toString('hex')}`
 * - [unimplemented] Nonces with a blockhash: nonce = `canvas:${topic}:${blockheight}:${blockhash}`
 *
 * The signer implementer is expected to verify that the FID,
 * farcasterSignerAddress, and session signer address match each other,
 * and the FID signer is still attached onchain.
 */
export type SIWFSessionData = {
	signature: Uint8Array
	domain: string
	farcasterSignerAddress: string
	canvasNonce: string
	fid: string
	issuedAt: string
	expirationTime: string
	notBefore: string
}

export type SIWFMessage = {
	version: string
	address: string
	chainId: number
	domain: string
	uri: string
	nonce: string
	issuedAt: string
	expirationTime: string
	notBefore: string
	resources: string[]
}
