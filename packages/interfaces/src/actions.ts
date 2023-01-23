import type { Chain } from "./contracts.js"

/**
 * An `ActionArgument` is type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values
 * that we put into and get out of action calls.
 *
 * The `blockhash` is optional, and if provided, may be used by nodes to validate
 * `timestamp`.
 */
export type ActionArgument = null | boolean | number | string

/**
 * An `ActionPayload` is the data signed by the user, either directly
 * or using a session key, to execute an action in a Canvas application.
 */
export type ActionPayload = {
	app: string
	from: string
	timestamp: number
	chain: Chain
	chainId: string
	blockhash: string | null
	call: string
	callArgs: Record<string, ActionArgument>
}

/**
 * An `ActionContext` is an `ActionPayload` minus `call` and `callArgs`.
 */
export interface ActionContext extends Omit<ActionPayload, "call" | "callArgs"> {}

/**
 * An `Action` is an `ActionPayload` and a signature.
 */
export type Action = {
	type: "action"
	payload: ActionPayload
	session: string | null
	signature: string
}

/**
 * Serialize an ActionPayload into a string suitable for signing on non-ETH chains.
 * The format is equivalent to JSON.stringify() with sorted object keys.
 *
 * -0 is serialized as 0, and NaN, Infinity, -Infinity are serialized as null.
 */
export function serializeActionPayload(payload: ActionPayload): string {
	if (payload === undefined || payload === null) return ""

	// callArgs is the only parameter of payload that needs sorting
	return JSON.stringify(
		{
			...payload,
			callArgs: { toJSON: () => JSON.stringify(payload.callArgs, Object.keys(payload.callArgs).sort()) },
		},
		Object.keys(payload).sort()
	)
}

export function serializeActionCallArgs(callArgs: Record<string, ActionArgument>) {
	return JSON.stringify(callArgs, Object.keys(callArgs).sort())
}

export function serializeActionArgument(arg: ActionArgument): string {
	return JSON.stringify(arg)
}
