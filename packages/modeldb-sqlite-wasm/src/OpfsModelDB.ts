import { logger } from "@libp2p/logger"
import * as Comlink from "comlink"
import {
	AbstractModelDB,
	parseConfig,
	Effect,
	ModelValue,
	ModelSchema,
	QueryParams,
	Config,
	getFilter,
} from "@canvas-js/modeldb"
import type { InnerModelDB } from "./InnerModelDB.js"
import { Remote } from "comlink"
import "./worker.js"


export interface ModelDBOptions {
	path: string
	models: ModelSchema
}

export class OpfsModelDB extends AbstractModelDB {
	private readonly worker: Worker
	private readonly wrappedDB: Remote<InnerModelDB>

	public static async initialize({ path, models }: ModelDBOptions) {
		const config = parseConfig(models)
		const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" })
		const initializeDB = Comlink.wrap(worker) as any
		const logProxy = Comlink.proxy(logger("canvas:modeldb:worker"))
		const wrappedDB = (await initializeDB(path, config, logProxy)) as Remote<InnerModelDB>
		return new OpfsModelDB({ worker: worker, wrappedDB, config })
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
		await this.wrappedDB.apply(effects)

		for (const { model, query, filter, callback } of this.subscriptions.values()) {
			if (effects.some(filter)) {
				try {
					const queryRes = await this.wrappedDB.query(model, query)
					callback(queryRes)
				} catch (err) {
					console.error(err)
				}
			}
		}
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
