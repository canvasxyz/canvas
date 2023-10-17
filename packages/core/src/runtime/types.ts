import type { ModelsInit, ModelValue } from "@canvas-js/modeldb"
import type { JSValue } from "@canvas-js/vm"

import type { Awaitable } from "../utils.js"

export type InlineContract = {
	topic: string
	models: ModelsInit
	actions: Record<string, ActionImplementation>
}

export type ActionImplementation = (
	db: Record<string, ModelAPI>,
	args: JSValue,
	context: ActionContext
) => Awaitable<void | JSValue>

export type GenericActionImplementation = (
	db: Record<string, ModelAPI>,
	args: any,
	context: ActionContext
) => Awaitable<void | JSValue>

export type ModelAPI = {
	get: (key: string) => Promise<ModelValue | null>
	set: (value: ModelValue) => Promise<void>
	delete: (key: string) => Promise<void>
}

export type ActionContext = { id: string; chain: string; address: string; blockhash: string | null; timestamp: number }
