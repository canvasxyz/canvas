export type EIP712Domain = {
	name: string
	version: string
	chainId: number
	verifyingContract: string
	salt: string
}

export type EIP712VerifiableSessionData = {
	signature: Uint8Array
	domain: EIP712Domain
}

export type EIP712VerifiableSessionMessage = {
	address: string
	publicKey: string
	blockhash: string | null
	timestamp: number
	duration: number | null
}

const actionType = [
	{ name: "name", type: "string" },
	{ name: "args", type: "string[]" },
	{ name: "address", type: "address" }, // the address that is delegated-signing the action
	{ name: "session", type: "address" }, // the burner address that is directly signing the action. this could be omitted in the future, but let's include and then revisit during code review
	{ name: "blockhash", type: "string" }, // may be "" if no blockhash
	{ name: "timestamp", type: "uint256" }, // this is actually overkill at uint24 is enough, but we can revisit during code review
	{ name: "duration", type: "uint256" },
]

const sessionType = [
	{ name: "address", type: "address" }, // the address that is delegated-signing the action
	{ name: "publicKey", type: "string" }, // the burner address that is being authorized to sign actions
	{ name: "blockhash", type: "string" }, // may be "" if no blockhash
	{ name: "timestamp", type: "uint256" }, // this is actually overkill at uint24 is enough, but we can revisit during code review
	{ name: "duration", type: "uint256" },
]

export const eip712TypeDefinitionsForAction = {
	// EIP712Domain: eip712DomainType,
	Action: actionType,
}

export const eip712TypeDefinitionsForSession = {
	// EIP712Domain: eip712DomainType,
	Session: sessionType,
}
