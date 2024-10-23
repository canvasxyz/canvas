import type { DeriveModelTypes, ModelSchema, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"

export type { ModelValue, ModelSchema, DeriveModelTypes } from "@canvas-js/modeldb"

export type Contract<
	Models extends ModelSchema = ModelSchema,
	Actions extends ActionSchema<Models> = ActionSchema<Models>,
> = {
	models: Models
	actions: Actions
}

export type ActionSchema<Models extends ModelSchema> = Record<string, ActionImplementation<Models>>

export type ActionImplementation<Models extends ModelSchema = ModelSchema, Args = any, Result = any> = (
	db: ModelAPI<DeriveModelTypes<Models>>,
	args: Args,
	context: ActionContext,
) => Awaitable<Result>

export type ModelAPI<ModelTypes extends Record<string, ModelValue>> = {
	get: <T extends keyof ModelTypes & string>(model: T, key: string) => Awaitable<ModelTypes[T] | null>
	set: <T extends keyof ModelTypes & string>(model: T, value: ModelTypes[T]) => Awaitable<void>
	create: <T extends keyof ModelTypes & string>(model: T, value: ModelTypes[T]) => Awaitable<void>
	update: <T extends keyof ModelTypes & string>(model: T, value: Partial<ModelTypes[T]>) => Awaitable<void>
	merge: <T extends keyof ModelTypes & string>(model: T, value: Partial<ModelTypes[T]>) => Awaitable<void>
	delete: <T extends keyof ModelTypes & string>(model: T, key: string) => Awaitable<void>
}

export type ActionContext = {
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
