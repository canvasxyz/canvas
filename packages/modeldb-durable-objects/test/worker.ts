import { ExecutionContext, DurableObjectNamespace, Request } from "@cloudflare/workers-types"

// export and bind durable objects defined in wrangler.toml
export { TestObject } from "./TestObject.js"
export interface Env {
	TEST_OBJECT: DurableObjectNamespace
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url)
		const uuid = url.pathname.split("/")[1]
		const id = env.TEST_OBJECT.idFromName(uuid)
		const stub = env.TEST_OBJECT.get(id)

		// forward request to durable object
		return stub.fetch(request)
	},
}
