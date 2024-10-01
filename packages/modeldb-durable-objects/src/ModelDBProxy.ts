import {
	AbstractModelDB,
	Effect,
	ModelSchema,
	ModelValue,
	parseConfig,
	QueryParams,
	WhereCondition,
} from "@canvas-js/modeldb"
import { Awaitable } from "@canvas-js/interfaces"
import { assert, prepare } from "@canvas-js/utils"
import * as json from "@ipld/dag-json"

import { ModelDB } from "./ModelDB.js"
import { randomUUID } from "./utils.js"
import { UnstableDevWorker } from "wrangler"

type Subscription = {
	model: string
	query: QueryParams
	filter: (effect: Effect) => boolean
	callback: (results: ModelValue[]) => Awaitable<void>
}

// A test proxy for Durable Objects. Uses extra requests to fetch subscriptions.
export class ModelDBProxy extends AbstractModelDB {
	worker: UnstableDevWorker
	baseUrl: string
	initialized: boolean
	uuid: string

	subscriptions: Map<number, Subscription>

	constructor(worker: UnstableDevWorker, models: ModelSchema, baseUrl?: string, uuid?: string) {
		super(parseConfig(models))

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

	async proxyFetch<T>(call: string, args: any[]): Promise<T> {
		if (!this.initialized && call !== "initialize") throw new Error("uninitialized")
		const body = json.stringify(args)
		const response = await this.worker.fetch(`${this.baseUrl}/${this.uuid}/${call}`, { method: "POST", body })
		if (!response.body) throw new Error("unexpected")
		if (!response.ok) throw new Error("error")
		const result = json.decode(await response.arrayBuffer()) as T

		// Update subscriptions. Could cause a race condition because of
		// the async call to /fetchSubscriptions, so only use for testing.
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
		if (!response.ok) throw new Error("error")
		const results = json.decode(await response.arrayBuffer()) as ModelValue[]
		return results
	}

	async close(): Promise<void> {
		await this.worker.stop()
		this.initialized = false
	}

	get<T extends ModelValue<any> = ModelValue<any>>(modelName: string, key: string): Awaitable<T | null> {
		return this.proxyFetch("get", [modelName, key])
	}

	async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query?: QueryParams,
	): AsyncIterable<T> {
		const items: T[] = await this.proxyFetch("iterate", [modelName, prepare(query)])
		for (const item of items) {
			yield item
		}
	}

	query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]> {
		return this.proxyFetch("query", [modelName, prepare(query)])
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

	set<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T): Promise<void> {
		return this.proxyFetch("set", [modelName, prepare(value)])
	}

	delete(modelName: string, key: string): Promise<void> {
		return this.proxyFetch("delete", [modelName, key])
	}

	subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[]) => Awaitable<void>,
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