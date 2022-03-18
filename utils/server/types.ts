/**
 *
 * A `ActionArgument` is a type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values that
 * we put into and get out of action calls.
 *
 * A `ModelType` is a runtime representation of an abstract model field type,
 * ie string values that we use to set the sqlite schema and coerce
 * action arguments.
 *
 * A `ModelValue` is a type-level representation of concrete model field types, ie
 * a TypeScript type that describes the possible JavaScript values that instantiate
 * the various ModelType options. This happens to be identical to `ActionArgument`
 * at the moment, but this is a "coincidence", so they're named different things.
 */

export type ModelType =
	| "boolean"
	| "string"
	| "integer"
	| "float"
	| "bytes"
	| "datetime"
	| `@${string}`

export type ModelValue = null | boolean | number | Uint8Array | Date | string

export type Model = Record<string, ModelType>

export type ActionArgument =
	| null
	| boolean
	| number
	| Uint8Array
	| Date
	| string

export type Action = {
	from: string
	blockhash: string
	timestamp: Date
	action: string
	args: ActionArgument[]
}

export type ContextModel = {
	create: (fields: Record<string, ModelValue>) => void
}

export type Context = {
	db: Record<string, ContextModel>
	// light client etc goes here too...
}

export type ActionHandler = (
	this: Context,
	...args: ActionArgument[]
) => Promise<void>
