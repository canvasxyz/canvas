import type { Chain, ChainId } from "./contracts.js"

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
 *
 * It is made of an `ActionContext` joined with `call` and `args`.
 */
export type ActionContext = {
	from: string
	spec: string
	timestamp: number
	chain: Chain
	chainId: ChainId
	blockhash: string | null
}

export type ActionPayload = ActionContext & {
	call: string
	args: Record<string, ActionArgument>
}

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
 * The format is equivalent to JSON.strinfigy(payload, null, "  "), but with sorted
 * object keys and with special handling for NaN, -0, and +/- Infinity.
 */
export function serializeActionPayload(payload: ActionPayload): string {
	const argKeys = Object.keys(payload.args).sort()
	const serializedArgEntries = argKeys.map(
		(key) => `\n    ${JSON.stringify(key)}: ${serializeActionArgument(payload.args[key])}`
	)

	const serializedArgs = serializedArgEntries.length === 0 ? "{}" : `{${serializedArgEntries.join(",")}\n  }`

	const payloadEntries = Object.entries(payload).sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))
	const serializedPayloadEntries = payloadEntries.map(([key, value]) => {
		if (key === "args") {
			return `\n  ${JSON.stringify(key)}: ${serializedArgs}`
		} else {
			return `\n  ${JSON.stringify(key)}: ${JSON.stringify(value)}`
		}
	})

	return `{${serializedPayloadEntries.join(",")}\n}`
}

// JSON.stringify has lossy behavior on the number values +/-Infinity, NaN, and -0.
// We never actually parse these serialized arguments anywhere - the only purpose here
// is to map them injectively to strings for signing.
export function serializeActionArgument(arg: ActionArgument): string {
	if (typeof arg === "number") {
		if (isNaN(arg)) {
			return "NaN"
		} else if (Object.is(arg, -0)) {
			return "-0.0"
		} else if (arg === Infinity) {
			return "+Infinity"
		} else if (arg === -Infinity) {
			return "-Infinity"
		}
	}

	return JSON.stringify(arg)
}
