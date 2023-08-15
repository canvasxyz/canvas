import { Signed, verifySignedValue } from "@canvas-js/signed-value"
import { Action, ActionArguments, ActionContext, Env, IPLDValue, Signer } from "@canvas-js/interfaces"
import { JSFunctionAsync, JSValue } from "@canvas-js/vm"
import { Encoding, createOrderedEncoding } from "@canvas-js/store"

import { assert, encodeTimestampVersion } from "./utils.js"
import { logger } from "@libp2p/logger"

export interface TopicHandler<Input = unknown> {
	topic: string
	encoding?: Encoding<IPLDValue>
	// codec: string // "dag-cbor" | "dag-json"
	apply(id: string, event: IPLDValue, env: Env): Promise<undefined | IPLDValue>
	create(input: Input, env: Env): Promise<IPLDValue>
}

export type ActionInput = { name: string; args: ActionArguments; chain?: string }

export class ActionHandler implements TopicHandler<ActionInput> {
	private static validateEvent(event: IPLDValue): event is Signed<Action> {
		// TODO: do the thing
		// (create packages/typed-value)
		return true
	}

	log = logger(`canvas:handler [${this.topic}]`)

	constructor(
		public readonly topic: string,
		private readonly actions: Record<string, JSFunctionAsync>,
		private readonly signers: Signer[]
	) {}

	public encoding = createOrderedEncoding<IPLDValue>({
		prefixByteLength: 6,
		getPrefix: (event) => {
			assert(ActionHandler.validateEvent(event), "invalid event")
			return encodeTimestampVersion(event.value.context.timestamp)
		},
	})

	public async apply(id: string, event: IPLDValue, env: Env): Promise<IPLDValue | undefined> {
		this.log("applying action %s", id)
		assert(ActionHandler.validateEvent(event), "invalid event")

		this.log("verifying action signature")
		verifySignedValue(event)
		this.log("finding matching signer")
		const { chain, address, name, args, context } = event.value
		const signer = this.signers.find((signer) => signer.match(chain))
		assert(signer !== undefined, `no signer provided for chain ${chain}`)
		this.log("verifying action")
		await signer.verify(event)
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)

		return await this.actions[name](args, { ...env, id, chain, address, ...context })
		// try {
		// 	this.log("got result", result)
		// 	return result
		// } catch (err) {
		// 	this.log.error("FJKDSLFJKSLDJFKLSDJF: %O", err)
		// }
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

export class CustomActionHandler implements TopicHandler<JSValue> {
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
