import type { SignatureType } from "@canvas-js/signed-cid"
import type { IPLDValue, JSONValue } from "./values.js"

type CBORValue = JSONValue<null | boolean | number | string | Uint8Array>

export type ActionArguments = CBORValue
export type SessionData = IPLDValue

export type Action = {
	type: "action"

	/** CAIP-2 prefix, e.g. "eip155:1" */
	chain: string
	/** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
	address: string

	topic: string
	name: string
	args: ActionArguments

	blockhash: string | null
	timestamp: number
}

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
