import type { DeriveModelTypes, ModelSchema, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"

export type { ModelValue, ModelSchema, DeriveModelTypes } from "@canvas-js/modeldb"

export type Contract<T extends ModelSchema = any> = {
	models: T
	actions: Record<string, ActionImplementation<DeriveModelTypes<T>>>
}

export type ActionImplementation<T extends Record<string, ModelValue>, Args extends Array<any> = any, Result = any> = (
	this: ActionContext<T>,
	db: ModelAPI<T>,
	...args: Args
) => Awaitable<Result>

export type ModelAPI<M extends Record<string, ModelValue>> = {
	get: <T extends keyof M & string>(model: T, key: string) => Awaitable<M[T] | null>
	set: <T extends keyof M & string>(model: T, value: M[T]) => Awaitable<void>
	create: <T extends keyof M & string>(model: T, value: M[T]) => Awaitable<void>
	update: <T extends keyof M & string>(model: T, value: Partial<M[T]>) => Awaitable<void>
	merge: <T extends keyof M & string>(model: T, value: Partial<M[T]>) => Awaitable<void>
	delete: <T extends keyof M & string>(model: T, key: string) => Awaitable<void>
}

export type ActionContext<T extends Record<string, ModelValue>> = {
	db: ModelAPI<T>
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
