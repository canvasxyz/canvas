import type { ModelSchema, ModelValue, IndexInit, PropertyType } from "@canvas-js/modeldb"
import type { Awaitable, SnapshotEffect } from "@canvas-js/interfaces"

export type Contract = {
	models: ModelSchema
	actions: Record<string, ActionImplementation>
}

export type Models = Contract["models"]
export type Actions = Contract["actions"]

export type ActionImplementation<Args = any> = ActionImplementationFunction<Args> | ActionImplementationObject<Args>

export type ActionImplementationObject<Args = any> = {
	argsType?: { schema: string; name: string }
	apply: ActionImplementationFunction<Args>
}

export type ActionImplementationFunction<Args = any> = (
	db: ModelAPI,
	args: Args,
	context: ActionContext,
) => Awaitable<void>

export type ModelAPI<ModelTypes extends Record<string, ModelValue> = Record<string, ModelValue>> = {
	get: <M extends keyof ModelTypes>(model: M, key: string) => Promise<ModelTypes[M] | null>
	set: <M extends keyof ModelTypes>(model: M, value: ModelTypes[M]) => Promise<void>
	merge: <M extends keyof ModelTypes>(model: M, value: ModelTypes[M]) => Promise<void>
	update: <M extends keyof ModelTypes>(model: M, value: ModelTypes[M]) => Promise<void>
	delete: <M extends keyof ModelTypes>(model: M, key: string) => Promise<void>
}

export type ActionContext = {
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
