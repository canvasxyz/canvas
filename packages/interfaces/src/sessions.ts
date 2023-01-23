import { Chain } from "./contracts.js"

/**
 * A `SessionPayload` is the data signed by the user to initiate a session.
 *
 * The `blockhash` is optional, and if provided, may be used by nodes to validate
 * `sessionIssued`.
 */
export type SessionPayload = {
	app: string
	from: string
	sessionAddress: string
	sessionDuration: number
	sessionIssued: number
	chain: Chain
	chainId: string
	blockhash: string | null
}

/**
 * A `Session` is a `SessionPayload` and a signature
 */
export type Session = {
	type: "session"
	payload: SessionPayload
	signature: string
}

/**
 * Serialize an SessionPayload into a string suitable for signing on non-ETH chains.
 * The format is equivalent to JSON.stringify() with sorted object keys.
 */
export function serializeSessionPayload(payload: SessionPayload): string {
	return JSON.stringify(payload, Object.keys(payload).sort())
}
