import type { DeriveModelTypes, ModelSchema, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"

export type { ModelValue, ModelSchema, DeriveModelTypes } from "@canvas-js/modeldb"

export type Contract<T extends ModelSchema = any> = {
	models: T
	actions: Record<string, ActionImplementation<DeriveModelTypes<T>>>
}

export type ActionImplementation<T extends Record<string, ModelValue>, Args = any> =
	| ActionImplementationFunction<T, Args>
	| ActionImplementationObject<T, Args>

export type ActionImplementationObject<T extends Record<string, ModelValue>, Args = any> = {
	argsType?: { schema: string; name: string }
	apply: ActionImplementationFunction<T, Args>
}

export type ActionImplementationFunction<T extends Record<string, ModelValue>, Args = any> = (
	db: ModelAPI<T>,
	args: Args,
	context: ActionContext,
) => Awaitable<void>

export type ModelAPI<M extends Record<string, ModelValue>> = {
	get: <T extends keyof M & string>(model: T, key: string) => Awaitable<M[T] | null>
	set: <T extends keyof M & string>(model: T, value: M[T]) => Awaitable<void>
	merge: <T extends keyof M & string>(model: T, value: Partial<M[T]>) => Awaitable<void>
	update: <T extends keyof M & string>(model: T, value: Partial<M[T]>) => Awaitable<void>
	delete: <T extends keyof M & string>(model: T, key: string) => Awaitable<void>
}

export type ActionContext = {
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
