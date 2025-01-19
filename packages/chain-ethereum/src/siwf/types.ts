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
	signature: Uint8Array,
	domain: string                 // immune-haddock-completely.ngrok-free.app
	farcasterSignerAddress: string // address delegated by Farcaster to produce our signature
	canvasNonce: string            // used to derive Farcaster nonce
	fid: string                    // 773313 => farcaster://fid/773313
	issuedAt: string               // issuedAt must be equal to `timestamp` in the parent session
	expirationTime: string         // expirationTime should be greater than `issuedAt` by ~10 minutes, and must be greater by no more than 60 minutes
	notBefore: string              // notBefore should be slightly less than `issuedAt`, and must be less by at most 60 minutes
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
