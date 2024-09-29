import { DurableObject } from "cloudflare:workers"
import { Env } from "./worker.js"
import { ModelDB } from "../src/index.js"

export class TestObject extends DurableObject {
	state: DurableObjectState
	env: Env
	db: ModelDB

	constructor(state: DurableObjectState, env: Env) {
		super(state, env)

		this.state = state
		this.env = env
		this.db = new ModelDB({
			db: state.storage.sql,
			models: {
				store: {
					key: "primary",
					value: "json",
				},
			},
		})
	}

	async get(request: Request) {
		const key = request.url.replace(/^https?:\/\//, "").split("/")[2]
		const value = await this.db.get("store", key)

		return new Response(JSON.stringify({ key, value }))
	}

	async post(request: Request) {
		const result = await request.json<Record<string, string>>()
		await this.db.set("store", result)

		return new Response(JSON.stringify({ status: "Success", result }))
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method === "GET") {
			return this.get(request)
		} else if (request.method === "POST") {
			return this.post(request)
		} else {
			throw new Error("unexpected method")
		}
	}
}
