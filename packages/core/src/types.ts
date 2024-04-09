import type { ModelsInit, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"

export type Contract = {
	topic: string
	models: ModelsInit
	actions: Record<string, ActionImplementation>
}

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

export type ModelAPI = {
	get: <T extends ModelValue = ModelValue>(model: string, key: string) => Promise<T | null>
	set: (model: string, value: ModelValue) => Promise<void>
	delete: (model: string, key: string) => Promise<void>
}

export type ActionContext = {
	id: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
