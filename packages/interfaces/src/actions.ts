import type { Chain } from "./contracts.js"

/**
 * An `ActionArgument` is type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values
 * that we put into and get out of action calls.
 *
 * The action timestamp may be expressed as a number or blockhash. We provide
 * `Block` for this. The action processor may choose to check `timestamp`
 * and/or `block` depending on which is provided.
 */
export type ActionArgument = null | boolean | number | string

/**
 * An `ActionPayload` is the data signed by the user, either directly
 * or using a session key, to execute an action in a Canvas application.
 */
export type ActionPayload = {
	from: string
	spec: string
	timestamp: number
	chain: Chain
	chainId: string
	blockhash: string | null
	call: string
	args: Record<string, ActionArgument>
}

/**
 * An `ActionContext` is an `ActionPayload` minus `call` and `args`.
 */
export interface ActionContext extends Omit<ActionPayload, "call" | "args"> {}

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

	// args is the only parameter of payload that needs sorting
	return JSON.stringify(
		{
			...payload,
			args: { toJSON: () => JSON.stringify(payload.args, Object.keys(payload.args).sort()) },
		},
		Object.keys(payload).sort()
	)
}

export function serializeActionArgument(arg: ActionArgument): string {
	return JSON.stringify(arg)
}
