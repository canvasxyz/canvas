import { AbstractModelDB, parseConfig, Effect, ModelValue, ModelSchema, QueryParams, Config } from "@canvas-js/modeldb"
import { MessageData } from "./types.js"

export interface ModelDBOptions {
	dbName: string | null
	models: ModelSchema
}

async function callWorker(worker: Worker, args: MessageData) {
	worker.postMessage(args)
	const result = await new Promise((resolve, reject) => {
		worker.onmessage = (event) => {
			resolve(event.data)
		}
		worker.onerror = (event) => {
			reject(event.error)
		}
	})
	// reset the listener methods
	worker.onmessage = null
	worker.onerror = null
	return result
}

export class ModelDB extends AbstractModelDB {
	public readonly path: string
	private readonly worker: Worker

	constructor({ path, models }: ModelDBOptions) {
		super(parseConfig(models))
		this.path = path || "canvas"
		this.worker = new Worker("./worker.js", { type: "module" })
	}

	public async close() {
		this.log("closing")
		this.worker.terminate()
	}

	public async apply(effects: Effect[]) {}

	public async get<T extends ModelValue>(modelName: string, key: string): Promise<T | null> {
		return (await callWorker(this.worker, { type: "get", modelName, key })) as any
	}

	public async *iterate(modelName: string): AsyncIterable<ModelValue> {
		return (await callWorker(this.worker, { type: "iterate", modelName })) as any
	}

	public async count(modelName: string): Promise<number> {
		return (await callWorker(this.worker, { type: "count", modelName })) as any
	}

	public async query<T extends ModelValue = ModelValue>(modelName: string, query: QueryParams = {}): Promise<T[]> {
		return (await callWorker(this.worker, { type: "query", modelName, query })) as any
	}
}
