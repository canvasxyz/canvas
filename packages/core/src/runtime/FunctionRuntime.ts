import type { SignerCache } from "@canvas-js/interfaces"
import { ModelSchema, ModelValue, validateModelValue, DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionContext, ActionImplementation, Contract, ModelAPI } from "../types.js"
import { AbstractRuntime, Transaction } from "./AbstractRuntime.js"

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

	readonly #db: ModelAPI<DeriveModelTypes<ModelsT>>

	#txn: Transaction | null = null

	protected get txn() {
		assert(this.#txn !== null, "expected this.#txn !== null")
		return this.#txn
	}

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		models: ModelSchema,
		public readonly actions: Record<string, ActionImplementation<ModelsT, any>>,
	) {
		super(models)
		this.#db = {
			get: async <T extends keyof DeriveModelTypes<ModelsT> & string>(model: T, key: string) => {
				const result = await this.getModelValue(this.txn, model, key)
				return result as DeriveModelTypes<ModelsT>[T]
			},
			set: async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.setModelValue(this.txn, model, value)
			},
			create: async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.setModelValue(this.txn, model, value)
			},
			update: async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.updateModelValue(this.txn, model, value as ModelValue)
			},
			merge: async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof value === "object", 'expected typeof value === "object"')
				await this.mergeModelValue(this.txn, model, value as ModelValue)
			},
			delete: async (model: string, key: string) => {
				await this.deleteModelValue(this.txn, model, key)
			},
		}
	}

	public close() {}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(txn: Transaction): Promise<void | any> {
		const { publicKey } = txn.signature
		const { address } = txn
		const {
			did,
			name,
			args,
			context: { blockhash, timestamp },
		} = txn.message.payload

		const action = this.actions[name]
		if (action === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		this.#txn = txn

		try {
			const actionContext: ActionContext<DeriveModelTypes<ModelsT>> = {
				db: this.#db,
				id: txn.id,
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
			this.#txn = null
		}
	}
}
