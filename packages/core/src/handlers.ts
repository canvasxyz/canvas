import { CBORValue } from "microcbor"

import { Signed, verifySignedValue } from "@canvas-js/signed-value"
import { Action, ActionArguments, ActionContext, Env, Signer } from "@canvas-js/interfaces"
import { JSFunctionAsync } from "@canvas-js/vm"

import { assert } from "./utils.js"

export interface TopicHandler<T = unknown, I = T> {
	topic: string
	// codec: string // "dag-cbor" | "dag-json"
	validate(event: T): Promise<void>
	apply(id: string, event: T, env: Env): Promise<void | CBORValue>
	create(input: I, env: Env): Promise<T>
}

export type ActionInput = { name: string; args: ActionArguments; chain?: string }

export class ActionHandler implements TopicHandler<Signed<Action>, ActionInput> {
	constructor(
		public readonly topic: string,
		private readonly actions: Record<string, JSFunctionAsync>,
		private readonly signers: Signer[]
	) {}

	public async validate(event: Signed<Action>): Promise<void> {
		verifySignedValue(event)
		const { chain, name } = event.value
		const signer = this.signers.find((signer) => signer.match(chain))
		assert(signer !== undefined, `no signer provided for chain ${chain}`)
		await signer.verify(event)
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)
	}

	public async apply(id: string, event: Signed<Action>, env: Env): Promise<void | CBORValue> {
		const { chain, address, name, args, context } = event.value
		return await this.actions[name](args, { ...env, id, chain, address, ...context })
	}

	public async create({ chain, name, args }: ActionInput, env: Env): Promise<Signed<Action>> {
		const signer = this.signers.find((signer) => chain === undefined || signer.match(chain))
		assert(signer !== undefined, `no signer provided for chain ${chain}`)

		const context: ActionContext = {
			topic: this.topic,
			timestamp: Date.now(),
			blockhash: null,
			// depth: 0,
			// dependencies: [],
		}

		return await signer.create(name, args, context, env)
	}
}

export class CustomActionHandler implements TopicHandler<CBORValue> {
	constructor(public readonly topic: string, private readonly applyFunction: JSFunctionAsync) {}

	public async validate(event: CBORValue): Promise<void> {}

	public async apply(id: string, event: CBORValue, env: Env): Promise<void | CBORValue> {
		return this.applyFunction(id, event, env)
	}

	public async create(input: CBORValue, env: Env): Promise<CBORValue> {
		return input
	}
}
