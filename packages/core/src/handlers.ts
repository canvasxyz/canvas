import { CBORValue } from "microcbor"

import { AbstractModelDB, ModelValue, getImmutableRecordKey, validateModelValue } from "@canvas-js/modeldb-interface"
import { Signed, verifySignedValue } from "@canvas-js/signed-value"
import { Action, ActionArguments, ActionContext, Env, Signer } from "@canvas-js/interfaces"
import { JSValue } from "@canvas-js/vm"

import { assert, signalInvalidType } from "./utils.js"

export interface Subscription<T = unknown, I = T> {
	topic: string
	// codec: string // "dag-cbor" | "dag-json"
	validate(event: T): Promise<void>
	apply(id: string, event: T, env: Env): Promise<void | JSValue>
	create(input: I, env: Env): Promise<T>
}

export type ActionInput = { name: string; args: ActionArguments; chain?: string }

export type ActionFunction = (id: string, event: Signed<Action>, env: Env) => void | JSValue | Promise<void | JSValue>
export type CustomActionFunction = (id: string, event: CBORValue, env: Env) => void | JSValue | Promise<void | JSValue>

export class ActionHandler implements Subscription<Signed<Action>, ActionInput> {
	constructor(
		public readonly topic: string,
		private readonly signers: Signer[],
		private readonly actions: Record<string, ActionFunction>
	) {}

	public async validate(event: Signed<Action>): Promise<void> {
		verifySignedValue(event)
		const { chain, name } = event.value
		const signer = this.signers.find((signer) => signer.match(chain))
		assert(signer !== undefined, `no signer provided for chain ${chain}`)
		await signer.verify(event)
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)
	}

	public async apply(id: string, event: Signed<Action>, env: Env): Promise<void | JSValue> {
		const { name } = event.value
		return await this.actions[name](id, event, env)
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

export class CustomActionHandler implements Subscription<CBORValue> {
	constructor(public readonly topic: string, private readonly applyFunction: CustomActionFunction) {}

	public async validate(event: CBORValue): Promise<void> {}

	public async apply(id: string, event: CBORValue, env: Env): Promise<void | JSValue> {
		return this.applyFunction(id, event, env)
	}

	public async create(input: CBORValue, env: Env): Promise<CBORValue> {
		return input
	}
}

export type EffectContext = {
	namespace: string
	version?: string
	effects: Effect[]
}

export type Effect =
	| { name: string; model: string; operation: "add"; key: string; value: ModelValue }
	| { name: string; model: string; operation: "set"; key: string; value: ModelValue }
	| { name: string; model: string; operation: "delete"; key: string }

export function getModelAPIs(name: string, db: AbstractModelDB, getEffectContext: () => EffectContext): JSValue {
	return Object.fromEntries(
		db.config.models.map((model) => {
			if (model.kind === "immutable") {
				const api = {
					add: async (value: JSValue) => {
						const { namespace, effects } = getEffectContext()
						const modelValue = value as ModelValue
						validateModelValue(model, modelValue)
						const key = getImmutableRecordKey(modelValue, { namespace })
						effects.push({ name, model: model.name, operation: "add", key, value: modelValue })
						return key
					},
					get: async (key: JSValue): Promise<ModelValue | null> => {
						assert(typeof key === "string", "key argument must be a string")
						return await db.get(model.name, key)
					},
				}

				return [model.name, api]
			} else if (model.kind === "mutable") {
				const api = {
					set: async (key: JSValue, value: JSValue) => {
						const { effects } = getEffectContext()
						assert(typeof key === "string", "key argument must be a string")
						const modelValue = value as ModelValue
						validateModelValue(model, modelValue)
						effects.push({ name, model: model.name, operation: "set", key, value: modelValue })
					},
					delete: async (key: JSValue) => {
						const { effects } = getEffectContext()
						assert(typeof key === "string", "key argument must be a string")
						effects.push({ name, model: model.name, operation: "delete", key })
					},
				}

				return [model.name, api]
			} else {
				signalInvalidType(model.kind)
			}
		})
	)
}
