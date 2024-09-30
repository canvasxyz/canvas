import { DurableObject } from "cloudflare:workers"
import { Env } from "./worker.js"
import { ModelDB } from "../src/ModelDB.js"
import { ModelSchema } from "@canvas-js/modeldb"

export class ModelDBProxyObject extends DurableObject {
	state: DurableObjectState
	env: Env
	db?: ModelDB

	constructor(state: DurableObjectState, env: Env) {
		super(state, env)
		this.state = state
		this.env = env
	}

	initialize(modelSchema: ModelSchema) {
		if (this.db) throw new Error("already initialized")
		this.db = new ModelDB({
			db: this.state.storage.sql,
			models: modelSchema,
		})
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== "POST") throw new Error("invalid method")
		const url = new URL(request.url)

		const [root, objectId, call] = url.pathname.split('/')
		const args = await request.json()

		if (call === "initialize") {
			const [modelSchema] = args as ModelSchema[]
			this.initialize(modelSchema)
			return new Response(JSON.stringify({ status: "Success" }))
		} else {
			const callFn = (this.db as any)[call] as Function
			const result = await callFn.apply(this.db, args)
			return new Response(JSON.stringify(result ?? {}))			
		}
	}
}
