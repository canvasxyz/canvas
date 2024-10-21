import type { DeriveModelTypes, ModelSchema, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"
import type { JSValue } from "@canvas-js/utils"

export type { ModelSchema, DeriveModelTypes } from "@canvas-js/modeldb"

export type Contract<T extends ModelSchema = any> = {
	models: T
	actions: Record<string, ActionImplementation<DeriveModelTypes<T>>>
	globals?: Record<string, ImportType>
}

export type ActionImplementation<T extends Record<string, ModelValue>, Args = any, Result = any> = (
	db: ModelAPI<T>,
	args: Args,
	context: ActionContext,
) => Awaitable<Result>

export type ModelAPI<M extends Record<string, ModelValue>> = {
	get: <T extends keyof M & string>(model: T, key: string) => Awaitable<M[T] | null>
	set: <T extends keyof M & string>(model: T, value: M[T]) => Awaitable<void>
	create: <T extends keyof M & string>(model: T, value: M[T]) => Awaitable<void>
	update: <T extends keyof M & string>(model: T, value: Partial<M[T]>) => Awaitable<void>
	merge: <T extends keyof M & string>(model: T, value: Partial<M[T]>) => Awaitable<void>
	delete: <T extends keyof M & string>(model: T, key: string) => Awaitable<void>
}

export type ImportType = JSValue | Function
export type CapturedImportType = { value: Uint8Array } | { fn: string }

export type ActionContext = {
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
