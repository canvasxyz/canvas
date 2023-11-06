import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"
import { fromDSL } from "@ipld/schema/from-dsl.js"

import type { SessionSigner } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelValue, validateModelValue } from "@canvas-js/modeldb"

import target from "#target"

import { assert, mapEntries, mapValues } from "../utils.js"

import { ActionImplementationFunction, Contract, ModelAPI } from "../types.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

const identity = (x: any) => x

export class FunctionRuntime extends AbstractRuntime {
	public static async init(
		path: string | null,
		signers: SessionSigner[],
		contract: Contract,
		options: { indexHistory?: boolean } = {}
	): Promise<FunctionRuntime> {
		const { indexHistory = true } = options
		const models = AbstractRuntime.getModelSchema(contract.models, { indexHistory })
		const db = await target.openDB({ path, topic: contract.topic }, models)

		const argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		> = {}

		const actions = mapEntries(contract.actions, ([actionName, action]) => {
			if (typeof action === "function") {
				argsTransformers[actionName] = { toTyped: identity, toRepresentation: identity }
				return action as ActionImplementationFunction
			}

			if (action.argsType !== undefined) {
				const { schema, name } = action.argsType
				argsTransformers[actionName] = create(fromDSL(schema), name)
			} else {
				argsTransformers[actionName] = { toTyped: identity, toRepresentation: identity }
			}

			return action.apply
		})

		return new FunctionRuntime(contract.topic, signers, db, actions, argsTransformers, indexHistory)
	}

	#context: ExecutionContext | null = null
	readonly #db: Record<string, ModelAPI>

	constructor(
		public readonly topic: string,
		public readonly signers: SessionSigner[],
		public readonly db: AbstractModelDB,
		public readonly actions: Record<string, ActionImplementationFunction>,
		public readonly argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		>,
		indexHistory: boolean
	) {
		super(indexHistory)

		this.#db = mapValues(this.db.models, (model): ModelAPI => {
			const primaryKeyProperty = model.properties.find((property) => property.kind === "primary")
			assert(primaryKeyProperty !== undefined)

			return {
				get: async <T extends ModelValue = ModelValue>(key: string) => {
					assert(this.#context !== null, "expected this.#context !== null")
					return await this.getModelValue<T>(this.#context, model.name, key)
				},
				set: async (value: ModelValue) => {
					assert(this.#context !== null, "expected this.#context !== null")
					validateModelValue(model, value)
					const key = value[primaryKeyProperty.name] as string
					this.#context.modelEntries[model.name][key] = value
				},
				delete: async (key: string) => {
					assert(this.#context !== null, "expected this.#context !== null")
					this.#context.modelEntries[model.name][key] = null
				},
			}
		})
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(context: ExecutionContext): Promise<void | any> {
		const { publicKey: signingKey } = context.signature
		const { address, name, args, blockhash, timestamp } = context.message.payload

		const argsTransformer = this.argsTransformers[name]
		const action = this.actions[name]
		assert(action !== undefined && argsTransformer !== undefined, `invalid action name: ${name}`)

		const typedArgs = argsTransformer.toTyped(args)
		assert(typedArgs !== undefined, "action args did not validate the provided schema type")

		this.#context = context

		try {
			return await action(this.#db, typedArgs, { id: context.id, address, signingKey, blockhash, timestamp })
		} finally {
			this.#context = null
		}
	}
}
