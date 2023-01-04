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
	blockhash: string | null
	chain: Chain
	chainId: ChainId
}

/**
 * A `Session` is a `SessionPayload` and a signature
 */
export type Session = {
	type: "session"
	payload: SessionPayload
	signature: string
}
