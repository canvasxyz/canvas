import type { ActionContext, Model, ModelValue } from "@canvas-js/interfaces"

export type Effect =
	| { type: "set"; model: string; id: string; values: Record<string, ModelValue> }
	| { type: "del"; model: string; id: string }

export interface ModelStore {
	readonly identifier: string
	initialize(models: Record<string, Model>, routes?: Record<string, string>): Promise<void>
	close(): void

	applyEffects(context: ActionContext, effects: Effect[]): Promise<void>
	getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]>
}
