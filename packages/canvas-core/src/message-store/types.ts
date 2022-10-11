export type BlockRecord = {
	chain: string
	chain_id: number
	blocknum: number
	blockhash: Buffer
	timestamp: number
}

export type ActionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer | null
	timestamp: number
	block_id: number | null
	call: string
	args: Buffer
}

export type SessionRecord = {
	hash: Buffer
	signature: Buffer
	from_address: Buffer
	session_address: Buffer
	duration: number
	timestamp: number
	block_id: number | null
}
