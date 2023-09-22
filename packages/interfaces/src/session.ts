import type { SignatureType } from "@canvas-js/signed-cid"

import type { IPLDValue } from "./values.js"

export type SessionData = IPLDValue

export type Session<Data = SessionData> = {
	type: "session"

	/** CAIP-2 prefix, e.g. "eip155:1" */
	chain: string
	/** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
	address: string

	topic: string
	publicKeyType: SignatureType
	publicKey: Uint8Array
	data: Data

	blockhash: string | null
	timestamp: number
	duration: number | null
}
