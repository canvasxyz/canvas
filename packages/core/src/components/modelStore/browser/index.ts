import type { ModelValue } from "@canvas-js/interfaces"

import type { Effect, ModelStore } from "../types.js"
export * from "../types.js"

class MemoryModelStore implements ModelStore {
	constructor() {
		throw new Error("not implemented")
	}

	public getModelNames(): string[] {
		throw new Error("not implemented")
	}

	public async *exportModel(modelName: string, options: { limit?: number } = {}) {
		throw new Error("not implemented")
	}

	async close() {
		throw new Error("not implemented")
	}

	async applyEffects(context: { timestamp: number }, effects: Effect[]): Promise<void> {
		throw new Error("not implemented")
	}

	async getRoute(route: string, params: Record<string, string> = {}): Promise<Record<string, ModelValue>[]> {
		throw new Error("not implemented")
	}
}

export const openModelStore = async (): Promise<ModelStore> => new MemoryModelStore()
