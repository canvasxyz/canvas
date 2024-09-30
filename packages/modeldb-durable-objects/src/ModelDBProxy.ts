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
import * as json from "@ipld/dag-json"

import { ModelDB } from "./ModelDB.js"
import { randomUUID } from "./utils.js"
import { UnstableDevWorker } from "wrangler"

export class ModelDBProxy extends AbstractModelDB {
	worker: UnstableDevWorker
	baseUrl: string
	initialized: boolean
	uuid: string

	constructor(worker: UnstableDevWorker, models: ModelSchema, baseUrl?: string, uuid?: string) {
		super(parseConfig(models))

		this.worker = worker
		this.baseUrl = baseUrl ?? "http://example.com"
		this.initialized = false
		this.uuid = uuid ?? randomUUID()

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
		const body = json.stringify(args)
		const response = await this.worker.fetch(`${this.baseUrl}/${this.uuid}/${call}`, { method: "POST", body })
		const result = (await response.json()) as T
		return result
	}

	async close(): Promise<void> {
		await this.worker.stop()
	}

	get<T extends ModelValue<any> = ModelValue<any>>(modelName: string, key: string): Awaitable<T | null> {
		return this.proxyFetch("get", [modelName, key])
	}

	// TODO
	iterate<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): AsyncIterable<T> {
		throw new Error("unimplemented")
	}

	query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Promise<T[]> {
		return this.proxyFetch("query", [modelName, query])
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
		return this.proxyFetch("set", [modelName, value])
	}

	delete(modelName: string, key: string): Promise<void> {
		return this.proxyFetch("delete", [modelName, key])
	}

	// TODO
	subscribe(
		modelName: string,
		query: QueryParams,
		callback: (results: ModelValue[]) => Awaitable<void>,
	): { id: number; results: Promise<ModelValue[]> } {
		throw new Error("unimplemented")
	}

	// TODO
	unsubscribe(id: number): void {
		throw new Error("unimplemented")
	}
}
