import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import pDefer, { DeferredPromise } from "p-defer"

import type { SignerCache } from "@canvas-js/interfaces"

import { ModelSchema, ModelValue, validateModelValue, DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionImplementation, Contract, ModelAPI } from "../types.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class FunctionRuntime<M extends ModelSchema> extends AbstractRuntime {
	public static async init<M extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<M>,
	): Promise<FunctionRuntime<M>> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")

		const schema = AbstractRuntime.getModelSchema(contract.models)
		return new FunctionRuntime(topic, signers, schema, contract.actions)
	}

	#context: ExecutionContext | null = null
	readonly #db: ModelAPI<DeriveModelTypes<M>>

	#lock: DeferredPromise<void> | null = null
	#concurrency: number = 0

	private async acquireLock() {
		while (this.#lock) {
			await this.#lock.promise
		}
		this.#lock = pDefer<void>()
		this.#concurrency++
	}

	private releaseLock() {
		if (this.#lock) {
			this.#lock.resolve()
			this.#lock = null
			this.#concurrency--
		}
	}

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly actions: Record<string, ActionImplementation<DeriveModelTypes<M>, any>>,
	) {
		super()

		this.#db = {
			get: async <T extends keyof DeriveModelTypes<M> & string>(model: T, key: string) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					const result = await this.getModelValue(this.#context, model, key)
					return result as DeriveModelTypes<M>[T]
				} finally {
					this.releaseLock()
				}
			},
			set: (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				validateModelValue(this.db.models[model], value)
				const { primaryKey } = this.db.models[model]
				assert(primaryKey in value, `db.set(${model}): missing primary key ${primaryKey}`)
				assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
				const key = (value as ModelValue)[primaryKey] as string

				this.#context.temporaryEffects[model][key] ||= []
				this.#context.temporaryEffects[model][key].push({
					operation: "set",
					value,
				})
			},
			create: (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				validateModelValue(this.db.models[model], value)
				const { primaryKey } = this.db.models[model]
				assert(primaryKey in value, `db.update(${model}): missing primary key ${primaryKey}`)
				assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
				const key = (value as ModelValue)[primaryKey] as string
				this.#context.temporaryEffects[model][key] ||= []
				this.#context.temporaryEffects[model][key].push({
					operation: "create",
					value,
				})
			},
			update: async (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				const { primaryKey } = this.db.models[model]
				assert(primaryKey in value, `db.update(${model}): missing primary key ${primaryKey}`)
				assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)

				const key = (value as ModelValue)[primaryKey] as string
				this.#context.temporaryEffects[model][key] ||= []
				this.#context.temporaryEffects[model][key].push({
					operation: "update",
					value: value as any,
				})
			},
			merge: async (model, value) => {
				assert(this.#context !== null, "expected this.#context !== null")
				const { primaryKey } = this.db.models[model]
				assert(primaryKey in value, `db.merge(${model}): missing primary key ${primaryKey}`)
				assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
				const key = (value as ModelValue)[primaryKey] as string
				this.#context.temporaryEffects[model][key] ||= []
				this.#context.temporaryEffects[model][key].push({
					operation: "merge",
					value: value as any,
				})
			},
			delete: async (model: string, key: string) => {
				assert(this.#context !== null, "expected this.#context !== null")
				this.#context.temporaryEffects[model][key] ||= []
				this.#context.temporaryEffects[model][key].push({
					operation: "delete",
				})
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
			const result = await action(this.#db, args, {
				id: context.id,
				publicKey,
				did,
				address,
				blockhash: blockhash ?? null,
				timestamp,
			})
			while (this.#concurrency > 0 || this.#lock) {
				await new Promise((resolve) => setTimeout(resolve, 10))
			}
			return result
		} finally {
			this.#context = null
		}
	}
}
