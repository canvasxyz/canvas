import PQueue from "p-queue"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelSchema, DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionContext, ActionImplementation, Contract, ModelAPI } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

export class FunctionRuntime<ModelsT extends ModelSchema> extends AbstractRuntime {
	public static async init<ModelsT extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<ModelsT>,
	): Promise<FunctionRuntime<ModelsT>> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")
		assert(
			Object.keys(contract.models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		const schema = AbstractRuntime.getModelSchema(contract.models)
		return new FunctionRuntime(topic, signers, schema, contract.actions)
	}

	#context: ExecutionContext | null = null
	#queue = new PQueue({ concurrency: 1 })
	#db: ModelAPI<DeriveModelTypes<ModelsT>>

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly actions: Record<string, ActionImplementation<ModelsT, any>>,
	) {
		super()

		this.#db = {
			get: async <T extends keyof DeriveModelTypes<ModelsT> & string>(model: T, key: string) => {
				const result = await this.#queue.add(() => this.context.getModelValue<DeriveModelTypes<ModelsT>[T]>(model, key))
				return result ?? null
			},

			set: (model, value) => this.#queue.add(() => this.context.setModelValue(model, value)),
			update: (model, value) => this.#queue.add(() => this.context.updateModelValue(model, value)),
			merge: (model, value) => this.#queue.add(() => this.context.mergeModelValue(model, value)),
			delete: (model, key) => this.#queue.add(() => this.context.deleteModelValue(model, key)),

			transaction: async (callback) => {
				await callback()
			},
		}
	}

	public close() {}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	private get context() {
		assert(this.#context !== null, "expected this.#context !== null")
		return this.#context
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
			const thisValue: ActionContext<DeriveModelTypes<ModelsT>> = {
				db: this.#db,
				id: context.id,
				publicKey,
				did,
				address,
				blockhash: blockhash ?? null,
				timestamp,
			}

			const result = await action.apply(thisValue, Array.isArray(args) ? [this.#db, ...args] : [this.#db, args])
			await this.#queue.onIdle()
			return result
		} catch (err) {
			console.log("dispatch action failed:", err)
			throw err
		} finally {
			this.#context = null
		}
	}
}
