// import { CID } from "multiformats/cid"

import { Config, ModelValue, Effect, Model, QueryParams, Resolver, Context } from "./types.js"
import { defaultResolver, getImmutableRecordKey } from "./utils.js"

export interface ModelDBOptions {
	resolver?: Resolver
}

export abstract class AbstractModelDB {
	public static getImmutableRecordKey = getImmutableRecordKey

	public readonly models: Record<string, Model>
	public readonly resolver: Resolver

	public constructor(public readonly config: Config, { resolver }: ModelDBOptions) {
		this.resolver = resolver ?? defaultResolver
		this.models = {}
		for (const model of config.models) {
			this.models[model.name] = model
		}
	}

	abstract close(): Promise<void>

	abstract get(modelName: string, key: string): Promise<ModelValue | null>

	abstract iterate(modelName: string): AsyncIterable<[key: string, value: ModelValue, version: Uint8Array | null]>

	// abstract query(modelName: string, query: QueryParams): Promise<ModelValue[]>

	abstract count(modelName: string): Promise<number>

	// Batch effect API

	public abstract apply(context: Context, effects: Effect[]): Promise<void>

	// Model operations

	public async add(
		modelName: string,
		value: ModelValue,
		context: { version?: Uint8Array | null } = {}
	): Promise<string> {
		const { version = null } = context
		const key = getImmutableRecordKey(value)
		await this.apply({ version }, [{ operation: "set", model: modelName, key, value }])
		return key
	}

	public async set(modelName: string, key: string, value: ModelValue, context: { version?: Uint8Array | null } = {}) {
		const { version = null } = context
		await this.apply({ version }, [{ operation: "set", model: modelName, key, value }])
	}

	public async delete(modelName: string, key: string, context: { version?: Uint8Array | null } = {}) {
		const { version = null } = context
		await this.apply({ version }, [{ operation: "delete", model: modelName, key }])
	}
}
