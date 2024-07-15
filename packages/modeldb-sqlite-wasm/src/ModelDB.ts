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
	private readonly worker: Worker

	public static async initialize({ dbName, models }: ModelDBOptions) {
		const config = parseConfig(models)
		const worker = new Worker("./worker.js", { type: "module" })
		await callWorker(worker, { type: "initialize", config, dbName: dbName || "canvas" })
		return new ModelDB({ worker, config })
	}

	private constructor({ worker, config }: { worker: Worker; config: Config }) {
		super(config)
		this.worker = worker
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
