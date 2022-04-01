import * as t from "io-ts"

/**
 * An `ActionArgument` is a type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values that
 * we put into and get out of action calls.
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
