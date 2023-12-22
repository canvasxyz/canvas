export type EIP712Domain = {
	name: string
	version: string
	chainId: number
	verifyingContract: string
	salt: string
}

export type EIP712SessionData = {
	signature: Uint8Array
	domain: EIP712Domain
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
		{ name: "publicKey", type: "string" }, // the burner address that is being authorized to sign actions
		{ name: "blockhash", type: "string" }, // may be "" if no blockhash
		{ name: "timestamp", type: "uint256" }, // this is actually overkill at uint24 is enough, but we can revisit during code review
		{ name: "duration", type: "uint256" },
	],
}
