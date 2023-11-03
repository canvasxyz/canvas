import type { SignatureType } from "./Signature.js"

/**
 * Sessions consist of an ephemeral keypair and some chain-specific
 * data representing a user's (temporary) authorization of that
 * keypair to sign actions on their behalf.
 */
export type Session<Data = any> = {
	type: "session"

	/** DID or CAIP-2 address (e.g. "eip155:1:0xb94d27...") */
	address: string

	/** ephemeral session key used to sign subsequent actions */
	publicKeyType: SignatureType
	publicKey: Uint8Array

	/** chain-specific session payload, e.g. a SIWE message & signature */
	data: Data

	timestamp: number
	blockhash: string | null
	duration: number | null
}
