/**
 * An `ActionArgument` is type-level representation of concrete action argument types,
 * ie TypeScript types that describe the possible JavaScript values
 * that we put into and get out of action calls.
 */
export type ActionArgument = null | boolean | number | string

/**
 * An `ActionPayload` is the data signed by the user, either directly
 * or using a session key, to execute an action in a Canvas application.
 */
export type ActionPayload = {
	from: string
	spec: string
	call: string
	args: ActionArgument[]
	timestamp: number
}

/**
 * An `Action` is an `ActionPayload` and a signature.
 */
export type Action = {
	payload: ActionPayload
	session: string | null
	signature: string
}

/**
 * An `ActionResult` is returned after successfully applying an action.
 */
export type ActionResult = {
	hash: string
}
