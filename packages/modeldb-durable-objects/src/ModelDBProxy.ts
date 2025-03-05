import { Unstable_DevWorker } from "wrangler"
import { encode, decode } from "microcbor"

import { Awaitable, assert } from "@canvas-js/utils"

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
	Model,
	Subscription,
} from "@canvas-js/modeldb"

import { randomUUID } from "./utils.js"

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

	public async hasModel(model: Model): Promise<boolean> {
		return await this.proxyFetch("hasModel", [model])
	}

	public getType(): ModelDBBackend {
		return "sqlite-durable-objects"
	}

	async proxyFetch<T>(call: string, args: any[]): Promise<T> {
		assert(this.initialized || call === "initialize", "uninitialized")

		const url = `${this.baseUrl}/${this.uuid}/${call}`
		const res = await this.worker.fetch(url, {
			method: "POST",
			headers: { accept: "application/cbor", "content-type": "application/cbor" },
			body: encode(args),
		})

		assert(res.ok, "expected response.ok")
		assert(res.body !== null, "expected response.body !== null")

		const body = await res.arrayBuffer()
		const result = decode(new Uint8Array(body)) as T

		// Update subscriptions. Could cause a race condition because of
		// the async call to /fetchSubscriptions.
		if (this.subscriptions.size > 0) {
			const url = `${this.baseUrl}/${this.uuid}/fetchSubscriptions`
			const subscriptionRes = await this.worker.fetch(url, { method: "POST" })
			if (!subscriptionRes.ok) {
				const err = await subscriptionRes.text()
				throw new Error(err)
			}

			assert(subscriptionRes.body !== null, "expected subscriptionRes.body !== null")
			const subscriptionBody = await subscriptionRes.arrayBuffer()
			const subscriptionResults = decode(new Uint8Array(subscriptionBody)) as {
				subscriptionId: number
				results: ModelValue[]
			}[]

			for (const { subscriptionId, results } of subscriptionResults) {
				this.subscriptions.get(subscriptionId)?.callback(results)
			}
		}

		return result
	}

	async fetchSubscriptions(): Promise<ModelValue[]> {
		const res = await this.worker.fetch(`${this.baseUrl}/${this.uuid}/fetchSubscriptions`, { method: "POST" })
		if (!res.ok) {
			const err = await res.text()
			throw new Error(err)
		}

		assert(res.body !== null, "expected response.body !== null")
		const body = await res.arrayBuffer()
		return decode(new Uint8Array(body)) as ModelValue[]
	}

	async close(): Promise<void> {
		this.initialized = false
	}

	async get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Promise<T | null> {
		return await this.proxyFetch("get", [modelName, key])
	}

	async getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Promise<T[]> {
		return await this.proxyFetch("getAll", [modelName])
	}

	async getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		keys: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Promise<(T | null)[]> {
		return await this.proxyFetch("getMany", [modelName, keys])
	}

	async *iterate<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		query?: QueryParams,
	): AsyncIterable<T> {
		const items: T[] = await this.proxyFetch("iterate", query ? [modelName, query] : [modelName])
		for (const item of items) {
			yield item
		}
	}

	async query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]> {
		return await this.proxyFetch("query", query ? [modelName, query] : [modelName])
	}

	async count(modelName: string, where?: WhereCondition): Promise<number> {
		return await this.proxyFetch("count", where ? [modelName, where] : [modelName])
	}

	async clear(modelName: string): Promise<void> {
		await this.proxyFetch("clear", [modelName])
	}

	async apply(effects: Effect[]): Promise<void> {
		await this.proxyFetch("apply", [effects])
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
			results: this.proxyFetch("subscribe", [modelName, query, id]).then(() => []),
		}
	}

	async unsubscribe(id: number): Promise<void> {
		this.subscriptions.delete(id)
		return this.proxyFetch("unsubscribe", [id])
	}
}
