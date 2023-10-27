export type Action = {
	type: "action"

	/** CAIP-2 prefix, e.g. "eip155:1" */
	chain: string
	/** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
	address: string

	name: string
	args: any

	timestamp: number
	blockhash: string | null
}
