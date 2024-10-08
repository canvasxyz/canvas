import type { ModelSchema, ModelValue, IndexInit, PropertyType } from "@canvas-js/modeldb"
import type { Awaitable, SnapshotEffect } from "@canvas-js/interfaces"
import type { JSValue } from "@canvas-js/utils"

export type Contract = {
	models: ModelSchema
	actions: Record<string, ActionImplementation>
	imports?: Record<string, ImportType>
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
	imports: Record<string, ImportType>, // TODO: these should be added to the scope instead
) => Awaitable<void>

// eslint-disable-next-line @typescript-eslint/ban-types
export type ImportType = JSValue | Function

export type CapturedImportType = { value: Uint8Array } | { fn: string }

export type ModelAPI = {
	get: <T extends ModelValue = ModelValue>(model: string, key: string) => Promise<T | null>
	set: (model: string, value: ModelValue) => Promise<void>
	merge: (model: string, value: ModelValue) => Promise<void>
	delete: (model: string, key: string) => Promise<void>
}

export type ActionContext = {
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
