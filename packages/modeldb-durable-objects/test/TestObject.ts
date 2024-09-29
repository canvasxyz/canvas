import {
	DurableObject,
	DurableObjectState,
	Request,
	Response as WorkerResponse,
	Headers,
	WebSocket,
	Body,
} from "@cloudflare/workers-types/experimental"
import { Env } from "./worker.js"

// can't import worker Response
export declare class Response extends Body {
	constructor(body?: BodyInit | null, init?: ResponseInit)
	static redirect(url: string, status?: number): Response
	static json(any: any, maybeInit?: ResponseInit | Response): Response
	clone(): Response
	get status(): number
	get statusText(): string
	get headers(): Headers
	get ok(): boolean
	get redirected(): boolean
	get url(): string
	get webSocket(): WebSocket | null
	get cf(): any | undefined
}

export class TestObject implements DurableObject {
	state: DurableObjectState
	env: Env
	storage: Record<string, string>

	constructor(state: DurableObjectState, env: Env) {
		this.state = state
		this.env = env
		this.storage = {}
	}

	async get(request: Request) {
		return new Response(JSON.stringify(this.storage))
	}

	async post(request: Request) {
		const json = await request.json<Record<string, string>>()

		for (const [key, value] of Object.entries(json)) {
			this.storage[key] = value
		}

		return new Response(JSON.stringify(this.storage))
	}

	async fetch(request: Request): Promise<WorkerResponse> {
		if (request.method === "GET") {
			return this.get(request)
		} else if (request.method === "POST") {
			return this.post(request)
		} else {
			throw new Error("unexpected method")
		}
	}
}
