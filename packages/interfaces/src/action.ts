import type { JSONValue } from "./values.js"

type CBORValue = JSONValue<null | boolean | number | string | Uint8Array>

export type ActionArguments = CBORValue
export type SessionPayload = CBORValue

export type Action = {
	// CAIP-2 prefix, e.g. "eip155:1"
	chain: string
	// CAIP-2 address (without the prefix, e.g. "0xb94d27...")
	address: string
	session: SessionPayload
	context: ActionContext
	name: string
	args: ActionArguments
}

export type ActionContext = {
	topic: string
	timestamp: number
	blockhash: string | null
	// depth: number
	// dependencies: Uint8Array[]
}
