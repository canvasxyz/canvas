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
					id: "primary",
					value: "json",
				},
			},
		})
	}

	async get(request: Request) {
		const key = request.url.replace(/^https?:\/\//, "").split("/")[2]
		const value = await this.db.get("store", key)
		return new Response(JSON.stringify(value))
	}

	async post(request: Request) {
		const result = await request.json<Record<string, string>>()
		await this.db.set("store", result)
		await new Promise((resolve) => setTimeout(resolve, 100))
		return new Response(JSON.stringify(result))
	}

	async clear(request: Request) {
		await this.db.clear("store")
		return new Response(JSON.stringify({ status: "Success" }))
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method === "GET") {
			// GET /d37f4bbf-d51c-4b20-8a1c-7bc53a588e4d
			return this.get(request)
		} else if (request.method === "POST" && request.url.endsWith("/clear")) {
			// POST /d37f4bbf-d51c-4b20-8a1c-7bc53a588e4d/clear
			return this.clear(request)
		} else if (request.method === "POST") {
			// POST /d37f4bbf-d51c-4b20-8a1c-7bc53a588e4d
			return this.post(request)
		} else {
			throw new Error("unexpected method")
		}
	}
}
