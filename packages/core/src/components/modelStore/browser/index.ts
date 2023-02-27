import type { ModelValue } from "@canvas-js/interfaces"

import type { Effect, ModelStore as IModelStore } from "../types.js"
export * from "../types.js"

export class ModelStore implements IModelStore {
	constructor() {
		throw new Error("not implemented")
	}

	async close() {}

	async applyEffects(context: { timestamp: number }, effects: Effect[]): Promise<void> {
		throw new Error("not implemented")
	}

	async getRoute(route: string, params: Record<string, string> = {}): Promise<Record<string, ModelValue>[]> {
		throw new Error("not implemented")
	}
}
