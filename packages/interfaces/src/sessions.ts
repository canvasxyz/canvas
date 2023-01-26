import { sha256 } from "crypto-hash"

import { Chain } from "./contracts.js"
import { stringify } from "./stringify.js"

/**
 * A `Session` is the data signed by the user to allow them to execute
 * multiple `Action` events using a delegated key.
 *
 * `block` is optional, and may be used to validate `sessionIssued`.
 */
export type Session = {
	type: "session"
	payload: {
		app: string
		appName: string
		block: string | null
		chain: Chain
		chainId: string
		from: string
		sessionAddress: string
		sessionDuration: number
		sessionIssued: number
	}
	signature: string
}

export type SessionPayload = Session["payload"]

/**
 * Serialize an SessionPayload into a string suitable for signing on non-ETH chains.
 * The format is equivalent to JSON.stringify() with sorted object keys.
 */
export function serializeSessionPayload(payload: SessionPayload): string {
	return stringify(payload)
}

export function serializeSession(session: Session): string {
	return stringify(session)
}

export async function getSessionHash(session: Session): Promise<string> {
	const hash = await sha256(stringify(session))
	return "0x" + hash
}
