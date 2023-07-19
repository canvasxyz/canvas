import { ModelValue } from "./types.js"

export interface IModelDB {
	close(): Promise<void>

	get(modelName: string, key: string): Promise<ModelValue | null>

	iterate(modelName: string): AsyncIterable<ModelValue>
	query(modelName: string, query: string): AsyncIterable<ModelValue>

	set(
		modelName: string,
		key: string,
		value: ModelValue,
		options: { metadata?: string; version?: string }
	): Promise<void>
	delete(modelName: string, key: string, options: { metadata?: string; version?: string }): Promise<void>

	add(modelName: string, value: ModelValue, options: { metadata?: string; namespace?: string }): Promise<string>
	remove(modelName: string, id: string, options: { metadata?: string; namespace?: string }): Promise<void>
}
