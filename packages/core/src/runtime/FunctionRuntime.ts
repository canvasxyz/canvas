import type { SignerCache } from "@canvas-js/interfaces"
import { ModelSchema, ModelValue, validateModelValue, DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionContext, ActionImplementation, Contract, ModelAPI } from "../types.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class FunctionRuntime<ModelsT extends ModelSchema> extends AbstractRuntime {
	public static init<ModelsT extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<ModelsT>,
	): FunctionRuntime<ModelsT> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")

		return new FunctionRuntime(topic, signers, contract.models, contract.actions)
	}

	#context: ExecutionContext | null = null
	readonly #db: ModelAPI<DeriveModelTypes<ModelsT>>

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		models: ModelSchema,
		public readonly actions: Record<string, ActionImplementation<ModelsT, any>>,
	) {
		super(models)
		this.#db = {
			get: async <T extends keyof DeriveModelTypes<ModelsT> & string>(model: T, key: string) => {
				assert(this.#context !== null, "expected this.#context !== null")
				const result = await this.getModelValue(this.#context, model, key)
				return result as DeriveModelTypes<ModelsT>[T]
			},
			set: async (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.setModelValue(this.#context, model, value)
			},
			create: async (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.setModelValue(this.#context, model, value)
			},
			update: async (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.updateModelValue(this.#context, model, value as ModelValue)
			},
			merge: async (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.mergeModelValue(this.#context, model, value as ModelValue)
			},
			delete: async (model: string, key: string) => {
				assert(this.#context !== null, "expected this.#context !== null")
				await this.deleteModelValue(this.#context, model, key)
			},
		}
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(context: ExecutionContext): Promise<void | any> {
		const { publicKey } = context.signature
		const { address } = context
		const {
			did,
			name,
			args,
			context: { blockhash, timestamp },
		} = context.message.payload

		const action = this.actions[name]
		if (action === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		this.#context = context

		try {
			const actionContext: ActionContext<DeriveModelTypes<ModelsT>> = {
				db: this.#db,
				id: context.id,
				publicKey,
				did,
				address,
				blockhash: blockhash ?? null,
				timestamp,
			}
			return await action.apply(actionContext, Array.isArray(args) ? [this.#db, ...args] : [this.#db, args])
		} catch (err) {
			console.log("dispatch action failed:", err)
			throw err
		} finally {
			this.#context = null
		}
	}
}
