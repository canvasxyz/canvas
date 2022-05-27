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

export const sessionPayloadType: t.Type<SessionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	session_public_key: t.string,
	session_duration: t.number,
})

export type Session = {
	payload: SessionPayload
	signature: string
}

export const sessionType: t.Type<Session> = t.type({
	payload: sessionPayloadType,
	signature: t.string,
})
