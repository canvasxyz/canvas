import * as t from "io-ts"
import { Model } from "./models"

/**
 * Actions
 *
 * An `ActionArgument` is a type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values that
 * we put into and get out of action calls.
 *
 * An `ActionPayload` is the data signed by the user, either directly or using a
 * session key.
 *
 * An `Action` holds an ActionPayload, its signature, and metadata needed to
 * establish the validity of the signature.
 *
 * Sessions
 *
 * A `SessionPayload` is the data signed by the user to initiate a session.
 *
 * A `Session` holds an ActionPayload, its signature, and metadata needed to
 * establish the validity of the session.
 *
 */

export type ActionArgument = null | boolean | number | string

export const actionArgumentType: t.Type<ActionArgument> = t.union([t.null, t.boolean, t.number, t.string])

export type ActionPayload = {
	from: string
	spec: string
	call: string
	args: ActionArgument[]
	timestamp: number
}

export const actionPayloadType: t.Type<ActionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	call: t.string,
	args: t.array(actionArgumentType),
})

// TODO: check if we want to keep chainId here
// TODO: add spec to action wrapper type
export type Action = {
	from: string
	chainId: string
	signature: string
	payload: string
}

export const actionType: t.Type<Action> = t.type({
	from: t.string,
	chainId: t.string,
	signature: t.string,
	payload: t.string,
})

/**
 * Sessions
 */

export type Session = {
	from: string
	signature: string
	payload: string
}

export const sessionType: t.Type<Session> = t.type({
	from: t.string,
	signature: t.string,
	payload: t.string,
})

export type SessionPayload = {
	from: string
	spec: string
	timestamp: number
	metadata: string
	session_public_key: string
}

export const sessionPayloadType: t.Type<SessionPayload> = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	metadata: t.string,
	session_public_key: t.string,
})

export const _sessions: Model = {
	session_public_key: "string",
	timestamp: "integer",
	metadata: "string",
	signature: "string",
}
