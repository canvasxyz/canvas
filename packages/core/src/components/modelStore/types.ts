import type { ModelValue } from "@canvas-js/interfaces"

export type Effect =
	| { type: "set"; model: string; id: string; values: Record<string, ModelValue> }
	| { type: "del"; model: string; id: string }

export interface ModelStore {
	close(): Promise<void>
	applyEffects(context: { timestamp: number }, effects: Effect[]): Promise<void>
	getRoute(route: string, params?: Record<string, string>): Promise<Record<string, ModelValue>[]>
	exportModel(modelName: string, options?: { offset: number; limit: number }): AsyncIterable<Record<string, ModelValue>>
	count(modelName: string): Promise<number>
}
