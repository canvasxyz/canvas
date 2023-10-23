import { TypeTransformerFunction } from "@ipld/schema/typed.js"

import type { Action, CBORValue, SessionSigner } from "@canvas-js/interfaces"
import { AbstractModelDB, ModelValue, validateModelValue } from "@canvas-js/modeldb"

import target from "#target"

import { assert, mapValues } from "../utils.js"

import { ActionImplementation, ActionImplementationFunction, InlineContract, ModelAPI, TActions } from "./types.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class FunctionRuntime extends AbstractRuntime {
	public static async init(
		location: string | null,
		signers: SessionSigner[],
		contract: InlineContract,
		options: { indexHistory?: boolean } = {}
	): Promise<FunctionRuntime> {
		const { indexHistory = true } = options
		const models = AbstractRuntime.getModelSchema(contract.models, { indexHistory })
		const db = await target.openDB(location, "models", models)
		const actions = mapValues(contract.actions, (apply) => {
			if (typeof apply === "function") {
				return {
					argsType: { toTyped: (x: any) => x, toRepresentation: (x: any) => x },
					apply: apply as ActionImplementationFunction,
				}
			} else {
				return { argsType: { toTyped: (x: any) => x, toRepresentation: (x: any) => x }, ...apply }
			}
		})

		return new FunctionRuntime(signers, db, actions, indexHistory)
	}

	#context: ExecutionContext | null = null
	readonly #db: Record<string, ModelAPI>

	constructor(
		public readonly signers: SessionSigner[],
		public readonly db: AbstractModelDB,
		public readonly actions: Record<
			string,
			{
				argsType: { toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
				apply: ActionImplementationFunction
			}
		>,
		indexHistory: boolean
	) {
		super(indexHistory)

		this.#db = {}
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(context: ExecutionContext, action: Action): Promise<CBORValue | void> {
		const { chain, address, name, args, blockhash, timestamp } = action
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)

		this.#context = context

		const api = mapValues(this.db.models, (model): ModelAPI => {
			const primaryKeyProperty = model.properties.find((property) => property.kind === "primary")
			assert(primaryKeyProperty !== undefined)

			return {
				get: async <T extends ModelValue = ModelValue>(key: string) => {
					assert(this.#context !== null, "expected this.#context !== null")
					return await this.getModelValue<T>(context, model.name, key)
				},
				set: async (value: ModelValue) => {
					assert(this.#context !== null, "expected this.#context !== null")
					validateModelValue(model, value)
					const key = value[primaryKeyProperty.name] as string
					context.modelEntries[model.name][key] = value
				},
				delete: async (key: string) => {
					assert(this.#context !== null, "expected this.#context !== null")
					context.modelEntries[model.name][key] = null
				},
			}
		})

		const result = await this.actions[name].apply(api, args, { id: context.id, chain, address, blockhash, timestamp })
		return result as CBORValue | void
	}
}
