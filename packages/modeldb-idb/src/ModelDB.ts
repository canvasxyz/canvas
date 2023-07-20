import { IModelDB, ModelValue, ModelsInit } from "@canvas-js/modeldb-interface"

export interface ModelDBOptions {
	dkLen?: number
	resolve?: (versionA: string, versionB: string) => string
}

export class ModelDB implements IModelDB {
	constructor(models: ModelsInit, options?: ModelDBOptions) {}

	public async close() {}

	public async get(modelName: string, key: string) {
		return null
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {}

	public query(modelName: string, query: {}): AsyncIterable<ModelValue> {
		throw new Error("not implemented")
	}

	public async set(modelName: string, key: string, value: ModelValue, options?: {}): Promise<void> {}

	public async delete(modelName: string, key: string, options?: {}): Promise<void> {}

	public async add(modelName: string, value: ModelValue, options?: {}): Promise<string> {
		throw new Error("not implemented")
	}

	public async remove(modelName: string, key: string): Promise<void> {}
}
