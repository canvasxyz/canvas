import { ExecutionContext, DurableObjectNamespace, Request } from "@cloudflare/workers-types"

// export and bind durable objects defined in wrangler.toml
export { ModelDBProxyObject } from "@canvas-js/modeldb-durable-objects"

export interface Env {
	PROXY_OBJECT: DurableObjectNamespace
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url)
		const uuid = url.pathname.split("/")[1]
		const id = env.PROXY_OBJECT.idFromName(uuid)
		const proxyObject = env.PROXY_OBJECT.get(id)

		// forward request to durable object
		return proxyObject.fetch(request)
	},
}
