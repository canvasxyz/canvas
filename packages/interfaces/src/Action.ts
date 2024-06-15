export type Action = {
	type: "action"

	/** DID of the user that authorized the session (e.g. "did:pkh:eip155:1:0xb94d27...") */
	address: string

	name: string
	args: any

	context: {
		blockhash?: string
		timestamp: number
	}
}
