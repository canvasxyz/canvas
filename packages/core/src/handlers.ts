import { Signed, verifySignedValue } from "@canvas-js/signed-value"
import { Action, ActionArguments, ActionContext, Env, IPLDValue, Signer } from "@canvas-js/interfaces"
import { JSFunctionAsync, JSValue } from "@canvas-js/vm"

import { assert, encodeTimestampVersion } from "./utils.js"
import { Encoding, createOrderedEncoding } from "@canvas-js/store"

export interface TopicHandler<T extends IPLDValue = IPLDValue, Input = unknown> {
	topic: string
	encoding?: Encoding<T>
	// codec: string // "dag-cbor" | "dag-json"
	apply(id: string, event: IPLDValue, env: Env): Promise<undefined | IPLDValue>
	create(input: Input, env: Env): Promise<IPLDValue>
}

export type ActionInput = { name: string; args: ActionArguments; chain?: string }

export class ActionHandler implements TopicHandler<Signed<Action>, ActionInput> {
	private static validateEvent(event: IPLDValue): event is Signed<Action> {
		// TODO: do the thing
		// (create packages/typed-value)
		return true
	}

	constructor(
		public readonly topic: string,
		private readonly actions: Record<string, JSFunctionAsync>,
		private readonly signers: Signer[]
	) {}

	public encoding = createOrderedEncoding<Signed<Action>>({
		prefixByteLength: 6,
		getPrefix: (event) => encodeTimestampVersion(event.value.context.timestamp),
	})

	public async apply(id: string, event: IPLDValue, env: Env): Promise<IPLDValue | undefined> {
		assert(ActionHandler.validateEvent(event), "invalid event")

		verifySignedValue(event)
		const { chain, address, name, args, context } = event.value
		const signer = this.signers.find((signer) => signer.match(chain))
		assert(signer !== undefined, `no signer provided for chain ${chain}`)
		await signer.verify(event)
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)

		const result = await this.actions[name](args, { ...env, id, chain, address, ...context })
		return result
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

export class CustomActionHandler implements TopicHandler<IPLDValue, JSValue> {
	public static validateEvent(event: IPLDValue): event is JSValue {
		// TODO: do the thing
		return true
	}

	constructor(
		public readonly topic: string,
		private readonly applyFunction: JSFunctionAsync,
		private readonly createFunction?: JSFunctionAsync
	) {}

	public async apply(id: string, event: IPLDValue, env: Env): Promise<undefined | JSValue> {
		assert(CustomActionHandler.validateEvent(event), "invalid event")
		const result = await this.applyFunction(id, event, env)
		return result
	}

	public async create(input: JSValue, env: Env): Promise<JSValue> {
		if (this.createFunction === undefined) {
			return input
		}

		const result = await this.createFunction(input, env)
		assert(result !== undefined, "custom action handler's create method did not return a value")
		return result
	}
}
