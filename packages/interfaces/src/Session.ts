/**
 * Sessions consist of an ephemeral keypair and some chain-specific
 * data representing a user's (temporary) authorization of that
 * keypair to sign actions on their behalf.
 */
export type Session<AuthorizationData = any> = {
	type: "session"

	/** DID or CAIP-2 address that authorized the session (e.g. "eip155:1:0xb94d27...") */
	address: string

	/** did:key URI of the ephemeral session key used to sign subsequent actions */
	publicKey: string

	/** chain-specific session payload, e.g. a SIWE message & signature */
	authorizationData: AuthorizationData

	blockhash: string | null
	timestamp: number
	duration: number | null
}
