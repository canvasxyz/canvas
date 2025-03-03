import { Effect, ModelSchema, ModelValue, ModelValueWithIncludes, QueryParams } from "@canvas-js/modeldb"
import * as json from "@ipld/dag-json"

import { Env } from "./ModelDBProxyWorker.js"
import { ModelDB } from "./ModelDB.js"

// A Durable Object that puts ModelDBProxy behind a stub Cloudflare worker.
export class ModelDBProxyObject {
	state: DurableObjectState
	env: Env
	db?: ModelDB

	subscriptionResults: Array<{ subscriptionId: number; results: ModelValue[] | ModelValueWithIncludes[] }>

	constructor(state: DurableObjectState, env: Env) {
		this.state = state
		this.env = env
		this.subscriptionResults = []
	}

	async initialize(modelSchema: ModelSchema) {
		if (this.db) throw new Error("already initialized")
		this.db = await ModelDB.open({
			db: this.state.storage.sql,
			models: modelSchema,
		})
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== "POST") throw new Error("invalid method")
		const url = new URL(request.url)

		const [root, objectId, call] = url.pathname.split("/")
		const args = call === "fetchSubscriptions" ? null : json.decode(await request.bytes())

		try {
			if (call === "initialize") {
				const [modelSchema] = args as ModelSchema[]
				this.initialize(modelSchema)
				return new Response(json.stringify({ status: "Success" }))
			} else if (call === "iterate") {
				if (!this.db) throw new Error("uninitialized")
				const iterateArgs = args as [string, QueryParams | undefined]
				const result = []
				for await (const item of this.db.iterate(...iterateArgs)) {
					result.push(item)
				}
				return new Response(json.stringify(result))
			} else if (call === "subscribe") {
				if (!this.db) throw new Error("uninitialized")
				const [modelName, query, subscriptionId] = args as [
					modelName: string,
					query: QueryParams,
					subscriptionId: number,
				]
				this.db.subscribe(modelName, query, (results: ModelValue[] | ModelValueWithIncludes[]) => {
					this.subscriptionResults.push({ subscriptionId, results })
				})
				return new Response(json.stringify(this.subscriptionResults))
			} else if (call === "fetchSubscriptions") {
				const result = json.stringify(this.subscriptionResults)
				this.subscriptionResults = []
				return new Response(result)
			} else if (call === "apply") {
				if (!this.db) throw new Error("uninitialized")
				const [effects] = args as [Effect[]]
				this.state.storage.transactionSync(() => this.db!.apply(effects))
				// await this.db.apply(effects)
				return new Response("null")
			} else {
				if (!this.db) throw new Error("uninitialized")
				// eslint-disable-next-line @typescript-eslint/ban-types
				const callFn = (this.db as any)[call] as Function
				const result = await callFn.apply(this.db, args)
				return new Response(json.stringify(result ?? null))
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : err
			const errorMessageString = (errorMessage as any)?.toString()
			return new Response(errorMessageString, { status: 400 })
		}
	}
}
