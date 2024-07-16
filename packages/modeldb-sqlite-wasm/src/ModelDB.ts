import * as Comlink from "comlink"
import { AbstractModelDB, parseConfig, Effect, ModelValue, ModelSchema, QueryParams, Config } from "@canvas-js/modeldb"
import type { InnerModelDB } from "./InnerModelDB.js"
import { Remote } from "comlink"

export interface ModelDBOptions {
	path: string
	models: ModelSchema
}

export class ModelDB extends AbstractModelDB {
	private readonly worker: Worker
	private readonly wrappedDB: Remote<InnerModelDB>

	public static async initialize({ path, models }: ModelDBOptions) {
		const config = parseConfig(models)
		const worker = new Worker("./worker.js", { type: "module" })
		const initializeDB = Comlink.wrap(worker) as any
		const wrappedDB = (await initializeDB(path, config)) as Remote<InnerModelDB>
		return new ModelDB({ worker, wrappedDB, config })
	}

	private constructor({
		worker,
		wrappedDB,
		config,
	}: {
		worker: Worker
		wrappedDB: Remote<InnerModelDB>
		config: Config
	}) {
		super(config)
		this.worker = worker
		this.wrappedDB = wrappedDB
	}

	public async close() {
		this.log("closing")
		this.worker.terminate()
	}

	public async apply(effects: Effect[]) {
		return this.wrappedDB.apply(effects)
	}

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		return this.wrappedDB.get(modelName, key) as Promise<T | null>
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		return this.wrappedDB.iterate(modelName)
	}

	public async count(modelName: string): Promise<number> {
		return this.wrappedDB.count(modelName)
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		return this.wrappedDB.query(modelName, query) as Promise<T[]>
	}
}
