import pDefer, { DeferredPromise } from "p-defer"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelSchema, ModelValue, validateModelValue, DeriveModelTypes } from "@canvas-js/modeldb"
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
	readonly #db: ModelAPI<DeriveModelTypes<ModelsT>>

	#lock: DeferredPromise<void> | null = null
	#waiting: number = 0

	private async acquireLock() {
		this.#waiting++
		while (this.#lock) {
			await this.#lock.promise
		}
		this.#lock = pDefer<void>()
	}

	private releaseLock() {
		assert(this.#lock, "internal error")
		this.#lock.resolve()
		this.#lock = null
		this.#waiting--
	}

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly actions: Record<string, ActionImplementation<ModelsT, any>>,
	) {
		super()

		this.#db = {
			get: async <T extends keyof DeriveModelTypes<ModelsT> & string>(model: T, key: string) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					const result = await this.#context.getModelValue(model, key)
					return result as DeriveModelTypes<ModelsT>[T]
				} finally {
					this.releaseLock()
				}
			},

			set: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					this.#context.setModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			},
			update: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					await this.#context.updateModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			},
			merge: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					await this.#context.mergeModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			},
			delete: async (model: string, key: string) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					this.#context.deleteModelValue(model, key)
				} finally {
					this.releaseLock()
				}
			},
		}
	}

	public close() {}

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
			const result = await action.apply(actionContext, Array.isArray(args) ? [this.#db, ...args] : [this.#db, args])
			while (this.#waiting > 0) {
				await new Promise((resolve) => setTimeout(resolve, 10))
			}
			return result
		} catch (err) {
			console.log("dispatch action failed:", err)
			throw err
		} finally {
			this.#context = null
		}
	}
}
