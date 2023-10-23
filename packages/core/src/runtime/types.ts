import type { ModelsInit, ModelValue } from "@canvas-js/modeldb"

import type { Awaitable } from "../utils.js"

/** This is type-level type; only used by generics, never values */
export type TActions = Record<string, { args: any; result: any }>

export type InlineContract = {
	models: ModelsInit
	actions: Record<string, ActionImplementation>
}

export type ActionImplementation<Args = any, Result = any> =
	| ActionImplementationFunction<Args, Result>
	| ActionImplementationObject<Args, Result>

export type ActionImplementationObject<Args = any, Result = any> = { apply: ActionImplementationFunction<Args, Result> }

export type ActionImplementationFunction<Args = any, Result = any> = (
	db: Record<string, ModelAPI>,
	args: Args,
	context: ActionContext
) => Awaitable<Result>

export type ModelAPI = {
	get: <T extends ModelValue = ModelValue>(key: string) => Promise<T | null>
	set: (value: ModelValue) => Promise<void>
	delete: (key: string) => Promise<void>
}

export type ActionContext = { id: string; chain: string; address: string; blockhash: string | null; timestamp: number }
