import * as t from "io-ts"
import { Model, ModelType, modelTypeType } from "./models.js"

/**
 * Specs
 *
 * Specs may be provided as strings or objects. These are the types for
 * constructing them as objects.
 *
 */

export type RouteType = string
export const routeTypeType = t.string

export type ActionType = Function
export const actionTypeType = t.Function

export type SpecModels = Record<string, Record<string, ModelType>>
export type SpecRoutes = Record<string, RouteType>
export type SpecActions = Record<string, ActionType>

export const specModelsType: t.Type<SpecModels> = t.record(t.string, t.record(t.string, modelTypeType))
export const specRoutesType: t.Type<SpecRoutes> = t.record(t.string, routeTypeType)
export const specActionsType: t.Type<SpecActions> = t.record(t.string, actionTypeType)

export type Spec = { models: SpecModels; routes: SpecRoutes; actions: SpecActions }
export const specType: t.Type<Spec> = t.type({
	models: specModelsType,
	routes: specRoutesType,
	actions: specActionsType,
})

/**
 * Actions
 *
 * An `Action` holds an ActionPayload or SessionPayload, its signature, and
 * metadata needed to establish the validity of the signature.
 *
 * An `ActionArgument` is a type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values that
 * we put into and get out of action calls.
 *
 * An `ActionPayload` is the data signed by the user, either directly or using a
 * session key, to execute an action in a Canvas application.
 *
 * A `SessionPayload` is the data signed by the user to initiate a session.
 *
 */

export type Action = {
	from: string
	session: string | null
	signature: string
	payload: string
}

export const actionType: t.Type<Action> = t.type({
	from: t.string,
	session: t.union([t.string, t.null]),
	signature: t.string,
	payload: t.string,
})

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

/**
 * Session Storage
 */

export const _sessions: Model = {
	session_public_key: "string",
	session_duration: "string",
	timestamp: "integer",
	signature: "string",
}
