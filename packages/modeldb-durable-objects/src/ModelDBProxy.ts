import * as json from "@ipld/dag-json"
import { Unstable_DevWorker } from "wrangler"

import {
	AbstractModelDB,
	ModelDBBackend,
	Effect,
	ModelSchema,
	ModelValue,
	ModelValueWithIncludes,
	QueryParams,
	WhereCondition,
	Config,
	PrimaryKeyValue,
} from "@canvas-js/modeldb"
import { Awaitable } from "@canvas-js/interfaces"
import { assert, prepare } from "@canvas-js/utils"

import { randomUUID } from "./utils.js"

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>
}

// A mock ModelDB that proxies requests to a Durable Objects via a ModelDBProxyWorker.
// Use this for testing only, it makes extra requests to fetch subscriptions.
export class ModelDBProxy extends AbstractModelDB {
	worker: Unstable_DevWorker
	baseUrl: string
	initialized: boolean
	uuid: string

	subscriptions: Map<number, Subscription>

	constructor(worker: Unstable_DevWorker, models: ModelSchema, baseUrl?: string, uuid?: string) {
		super(Config.parse(models), {
			[AbstractModelDB.namespace]: AbstractModelDB.version,
		})

		this.worker = worker
		this.baseUrl = baseUrl ?? "http://example.com"
		this.initialized = false
		this.uuid = uuid ?? randomUUID()

		this.subscriptions = new Map<number, Subscription>()

		this.proxyFetch("initialize", [models]).then(() => {
			this.initialized = true
		})
	}

	// wait for async init
	async initialize(): Promise<void> {
		return new Promise<void>((resolve) => {
			const timer = setInterval(() => {
				if (this.initialized) {
					clearInterval(timer)
					resolve()
				}
			})
		})
	}

	public getType(): ModelDBBackend {
		return "sqlite-durable-objects"
	}

	async proxyFetch<T>(call: string, args: any[]): Promise<T> {
		if (!this.initialized && call !== "initialize") throw new Error("uninitialized")
		const body = json.stringify(args)
		const response = await this.worker.fetch(`${this.baseUrl}/${this.uuid}/${call}`, { method: "POST", body })
		if (!response.body) throw new Error("unexpected")
		if (!response.ok) throw new Error(await response.text())
		const result = json.decode(await response.arrayBuffer()) as T

		// Update subscriptions. Could cause a race condition because of
		// the async call to /fetchSubscriptions.
		if (this.subscriptions.size > 0) {
			const subscriptionResponse = await this.worker.fetch(`${this.baseUrl}/${this.uuid}/fetchSubscriptions`, {
				method: "POST",
			})
			const subscriptionResults = json.decode<Array<{ subscriptionId: number; results: ModelValue[] }>>(
				await subscriptionResponse.arrayBuffer(),
			)
			for (const { subscriptionId, results } of subscriptionResults) {
				this.subscriptions.get(subscriptionId)?.callback(results)
			}
		}

		return result
	}

	async fetchSubscriptions(): Promise<ModelValue[]> {
		const response = await this.worker.fetch(`${this.baseUrl}/${this.uuid}/fetchSubscriptions`, { method: "POST" })
		if (!response.body) throw new Error("unexpected")
		if (!response.ok) throw new Error(await response.text())
		const results = json.decode(await response.arrayBuffer()) as ModelValue[]
		return results
	}

	async close(): Promise<void> {
		this.initialized = false
	}

	get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Awaitable<T | null> {
		return this.proxyFetch("get", [modelName, key])
	}

	getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Awaitable<T[]> {
		return this.proxyFetch("getAll", [modelName])
	}

	getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Awaitable<(T | null)[]> {
		return this.proxyFetch("getMany", [modelName, keys])
	}

	async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query?: QueryParams,
	): AsyncIterable<T> {
		const items: T[] = await this.proxyFetch("iterate", query ? [modelName, prepare(query)] : [modelName])
		for (const item of items) {
			yield item
		}
	}

	query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]> {
		return this.proxyFetch("query", query ? [modelName, prepare(query)] : [modelName])
	}

	count(modelName: string, where?: WhereCondition): Promise<number> {
		return this.proxyFetch("count", where ? [modelName, where] : [modelName])
	}

	clear(modelName: string): Promise<void> {
		return this.proxyFetch("clear", [modelName])
	}

	apply(effects: Effect[]): Promise<void> {
		return this.proxyFetch("apply", [effects])
	}

	subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>,
	): { id: number; results: Promise<ModelValue[]> } {
		const model = this.models[modelName]
		assert(model !== undefined, `model ${modelName} not found`)

		const filter = this.getEffectFilter(model, query)
		const id = Math.floor(Math.random() * 10_000_000) // random integer id
		this.subscriptions.set(id, { model: modelName, query, filter, callback })

		return {
			id,
			results: this.proxyFetch("subscribe", [modelName, prepare(query), id]).then(() => []),
		}
	}

	async unsubscribe(id: number): Promise<void> {
		this.subscriptions.delete(id)
		return this.proxyFetch("unsubscribe", [id])
	}
}
