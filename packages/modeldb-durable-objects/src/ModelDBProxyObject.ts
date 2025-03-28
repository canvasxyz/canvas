import { encode, decode } from "microcbor"
import { assert } from "@canvas-js/utils"
import { Effect, ModelSchema, ModelValue, ModelValueWithIncludes, QueryParams } from "@canvas-js/modeldb"

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

	async initialize(models: ModelSchema) {
		if (this.db) throw new Error("already initialized")
		this.db = await ModelDB.open(this.state.storage.sql, { models })
	}

	async fetch(request: Request): Promise<Response> {
		assert(request.method === "POST", 'expected request.method === "POST"')

		const url = new URL(request.url)
		const [root, objectId, call] = url.pathname.split("/")
		const args = call === "fetchSubscriptions" ? null : decode(await request.bytes())

		try {
			if (call === "initialize") {
				const [modelSchema] = args as ModelSchema[]
				this.initialize(modelSchema)
				return new Response(encode({ status: "Success" }))
			} else if (call === "iterate") {
				if (!this.db) throw new Error("uninitialized")
				const iterateArgs = args as [string, QueryParams | undefined]
				const result = []
				for await (const item of this.db.iterate(...iterateArgs)) {
					result.push(item)
				}
				return new Response(encode(result))
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
				return new Response(encode(this.subscriptionResults))
			} else if (call === "fetchSubscriptions") {
				const result = encode(this.subscriptionResults)
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
				const callFn = (this.db as any)[call] as Function
				const result = await callFn.apply(this.db, args)
				return new Response(encode(result ?? null))
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : err
			const errorMessageString = (errorMessage as any)?.toString()
			return new Response(errorMessageString, { status: 400 })
		}
	}
}
