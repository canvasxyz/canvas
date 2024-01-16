export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export type EIP712SessionData = {
	signature: Uint8Array
}

export function validateEIP712SessionData(authorizationData: unknown): authorizationData is EIP712SessionData {
	try {
		const { signature } = authorizationData as any
		assert(signature instanceof Uint8Array, "signature must be a Uint8Array")

		return true
	} catch (e) {
		return false
	}
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
