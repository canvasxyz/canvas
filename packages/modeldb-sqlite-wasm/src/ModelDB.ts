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
	Model,
} from "@canvas-js/modeldb"
import type { InnerModelDB } from "./InnerModelDB.js"
import { Remote } from "comlink"
import { Awaitable } from "@canvas-js/modeldb/src/utils.js"
import assert from "assert"

export interface ModelDBOptions {
	path: string
	models: ModelSchema
}

export class ModelDB extends AbstractModelDB {
	private readonly worker: Worker
	private readonly wrappedDB: Remote<InnerModelDB>
	private subscriptionId = 0

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

	private getEffectFilter_(model: Model, query: QueryParams): (effect: Effect) => boolean {
		const filter = getFilter(model, query.where)

		return (effect) => {
			if (effect.model !== model.name) {
				return false
			}

			if (effect.operation === "set") {
				if (!filter(effect.value)) {
					return false
				}
			}

			// TODO: we could do more to filter out more effects:
			// - look up the previous value before deleting and see if it was a possible query result
			// - for queries with defined a order and limit, track the order property value of the
			//   last query result, and if the a new value is set with a later order property value,
			//   filter the effect out.

			return true
		}
	}

	public subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[]) => Awaitable<void>,
	): { id: number; results: Promise<ModelValue[]> } {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)

		const filter = this.getEffectFilter_(model, query)
		const id = this.subscriptionId++
		// this is async but don't wait for it
		this.wrappedDB.subscribe(id, modelName, query, Comlink.proxy(filter), Comlink.proxy(callback))

		return {
			id,
			results: this.query(modelName, query).then((results) =>
				Promise.resolve(callback(results)).then(
					() => results,
					(err) => {
						this.log.error(err)
						return results
					},
				),
			),
		}
	}
}
