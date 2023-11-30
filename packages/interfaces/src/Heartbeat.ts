export type Heartbeat = {
	type: "heartbeat"
	/** DID or CAIP-2 address (e.g. "eip155:1:0xb94d27...") */
	address: string
	data: any
	timestamp: number
}
