/**
 * A `SessionPayload` is the data signed by the user to initiate a session.
 */
export type SessionPayload = {
	from: string
	spec: string
	timestamp: number
	session_public_key: string
	session_duration: number
}

/**
 * A `Session` is a `SessionPayload` and a signature
 */
export type Session = {
	payload: SessionPayload
	signature: string
}
