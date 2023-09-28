import type { JSONValue } from "./values.js"

type CBORValue = JSONValue<null | boolean | number | string | Uint8Array>

export type ActionArguments = CBORValue

export type Action = {
	type: "action"

	/** CAIP-2 prefix, e.g. "eip155:1" */
	chain: string
	/** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
	address: string

	name: string
	args: ActionArguments

	blockhash: string | null
	timestamp: number
}
