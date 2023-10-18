import type { ModelsInit, ModelValue } from "@canvas-js/modeldb"

import type { Awaitable } from "../utils.js"

// /** This is type-level type; only used by generics, never values */
// export type TSignature = { args: any; result: unknown }

// /** This is type-level type; only used by generics, never values */
// export type TActions = Record<string, TSignature>

export type InlineContract<
	Actions extends Record<string, ActionImplementation> = Record<string, ActionImplementation>
> = {
	models: ModelsInit
	actions: Actions
}

export type ActionImplementation<Args = any, Result = any> = (
	db: Record<string, ModelAPI>,
	args: Args,
	context: ActionContext
) => Awaitable<Result>

export type ModelAPI = {
	get: (key: string) => Promise<ModelValue | null>
	set: (value: ModelValue) => Promise<void>
	delete: (key: string) => Promise<void>
}

export type ActionContext = { id: string; chain: string; address: string; blockhash: string | null; timestamp: number }
