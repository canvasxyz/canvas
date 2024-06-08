export type Action = {
	type: "action"

	/** DID or CAIP-2 address (e.g. "eip155:1:0xb94d27...") */
	address: string

	name: string
	args: any

	context: {
		blockhash?: string
		timestamp: number
	}
}
