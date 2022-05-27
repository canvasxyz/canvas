import * as t from "io-ts"

import type { Model } from "./models.js"

/**
 * Actions
 *
 * An `ActionArgument` is a type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values that
 * we put into and get out of action calls.
 *
 * An `ActionPayload` is the data signed by the user, either directly or using a
 * session key, to execute an action in a Canvas application.
 *
 * An `Action` is an `ActionPayload` and a signature.
 *
 * An `ActionResult` is returned after successfully applying an action.
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

export type Action = {
	payload: ActionPayload
	session: string | null
	signature: string
}

export const actionType: t.Type<Action> = t.type({
	payload: actionPayloadType,
	session: t.union([t.string, t.null]),
	signature: t.string,
})

export type ActionResult = {
	hash: string
}

/**
 * Session Storage
 */

export const _sessions: Model = {
	session_public_key: "string",
	session_duration: "string",
	timestamp: "integer",
	signature: "string",
}
