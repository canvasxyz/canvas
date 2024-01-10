export type EIP712SessionData = {
	signature: Uint8Array
}

export type EIP712SessionMessage = {
	address: string
	publicKey: string
	blockhash: string | null
	timestamp: number
	duration: number | null
}

export const eip712TypeDefinitions = {
	Session: [
		{ name: "address", type: "address" }, // the address that is delegated-signing the action
		{ name: "blockhash", type: "string" }, // may be "" if no blockhash
		{ name: "duration", type: "uint256" },
		{ name: "publicKey", type: "string" }, // the burner address that is being authorized to sign actions
		{ name: "timestamp", type: "uint256" }, // this is actually overkill at uint24 is enough, but we can revisit during code review
	],
}
