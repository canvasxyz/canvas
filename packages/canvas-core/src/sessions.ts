import * as t from "io-ts"

/**
 * Sessions
 *
 * A `SessionPayload` is the data signed by the user to initiate a session.
 * A `Session` is a `SessionPayload` and a signature
 */

export type SessionPayload = {
	from: string
	spec: string
	timestamp: number
	session_public_key: string
	session_duration: number
}

export type Session = {
	signature: string
	payload: SessionPayload
}

export const sessionType: t.Type<Session> = t.type({
	signature: t.string,
	payload: t.type({
		from: t.string,
		spec: t.string,
		timestamp: t.number,
		session_public_key: t.string,
		session_duration: t.number,
	}),
})
