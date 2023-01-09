import { Chain, ChainId } from "./contracts.js"

/**
 * A `SessionPayload` is the data signed by the user to initiate a session.
 *
 * The session timestamp may be expressed as a number or blockhash. We use
 * `Block` for this. The message processor may choose to check `timestamp`
 * and/or `block` depending on which is provided.
 */
export type SessionPayload = {
	from: string
	spec: string
	timestamp: number
	address: string
	duration: number
	chain: Chain
	chainId: ChainId
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
 * The format is equivalent to JSON.stringify(payload, null, "  ") but with sorted
 * object keys.
 */
export function serializeSessionPayload(payload: SessionPayload): string {
	const keys = Object.keys(payload).sort()
	return JSON.stringify(payload, keys, "  ")
}
