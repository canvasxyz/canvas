import { ModelValue } from "./types.js"

export interface IModelDB {
	close(): void

	get(modelName: string, key: string): ModelValue | null

	iterate(modelName: string): AsyncIterable<ModelValue>
	query(modelName: string, query: string): AsyncIterable<ModelValue>

	set(modelName: string, key: string, value: ModelValue, options: { metadata?: string; version?: string }): void
	delete(modelName: string, key: string, options: { metadata?: string; version?: string }): void

	add(modelName: string, value: ModelValue, options: { metadata?: string; namespace?: string }): string
	remove(modelName: string, id: string, options: { metadata?: string; namespace?: string }): void
}
