import { sha256 } from "crypto-hash"

import type { Chain } from "./contracts.js"
import { stringify } from "./stringify.js"

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
		from: string
		call: string
		callArgs: Record<string, ActionArgument>
		chain: Chain
		chainId: string
		block: string | null
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
 * Serialize an `ActionPayload` into a string suitable for signing on non-ETH chains.
 * The format is equivalent to JSON.stringify() with sorted object keys.
 */
export function serializeActionPayload(payload: ActionPayload): string {
	return stringify(payload)
}

/**
 * Serialize a `Session` for storage or hashing.
 */
export function serializeAction(action: Action): string {
	return stringify(action)
}

/**
 * Unique identifier for signed actions.
 */
export async function getActionHash(action: Action): Promise<string> {
	const hash = await sha256(stringify(action))
	return "0x" + hash
}
