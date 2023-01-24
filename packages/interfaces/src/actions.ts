import type { Chain } from "./contracts.js"

/**
 * An `ActionArgument` defines what types of data may be passed to actions.
 *
 * These are the same as datatypes supported by JSON serialization, except
 * TypeScript does not enforce standard serializations of -0, +/-Infinity,
 * and NaN, which all stringify as `null`.
 */
export type ActionArgument = null | boolean | number | string

/**
 * An `Action` is the data signed by the user, either directly or
 * using a session key, to execute an action in a Canvas application.
 *
 * `block` is optional, and may be used by nodes to validate `timestamp`.
 */
export type Action = {
	type: "action"
	payload: {
		app: string
		appName: string
		block: string | null
		call: string
		callArgs: Record<string, ActionArgument>
		chain: Chain
		chainId: string
		from: string
		timestamp: number
	}
	session: string | null
	signature: string
}

export type ActionPayload = Action["payload"]

/**
 * An `ActionContext` is an `ActionPayload` minus `call` and `callArgs`,
 * used for processing effects of actions.
 */
export interface ActionContext extends Omit<ActionPayload, "call" | "callArgs"> {}

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
