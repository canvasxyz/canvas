import type { SignatureType } from "./signature.js"
import type { IPLDValue } from "./values.js"

export type SessionData = IPLDValue

export type Session<Data = SessionData> = {
	type: "session"

	/** CAIP-2 prefix, e.g. "eip155:1" for mainnet Ethereum */
	chain: string
	/** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
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
