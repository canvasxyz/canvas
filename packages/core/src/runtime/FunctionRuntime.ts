import { TypeTransformerFunction, create } from "@ipld/schema/typed.js"
import { fromDSL } from "@ipld/schema/from-dsl.js"
import pDefer, { DeferredPromise } from "p-defer"

import type { SignerCache } from "@canvas-js/interfaces"
import {
	ModelSchema,
	ModelValue,
	validateModelValue,
	mergeModelValues,
	updateModelValues,
	DeriveModelTypes,
} from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionImplementation, Contract, ModelAPI } from "../types.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class FunctionRuntime<ModelsT extends ModelSchema> extends AbstractRuntime {
	public static async init<ModelsT extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<ModelsT>,
	): Promise<FunctionRuntime<ModelsT>> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")

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
					const result = await this.getModelValue(this.#context, model, key)
					return result as DeriveModelTypes<ModelsT>[T]
				} finally {
					this.releaseLock()
				}
			},
			set: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					validateModelValue(this.db.models[model], value)
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.set(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					this.#context.modelEntries[model][key] = value
				} finally {
					this.releaseLock()
				}
			},
			create: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					validateModelValue(this.db.models[model], value)
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.update(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					this.#context.modelEntries[model][key] = value
				} finally {
					this.releaseLock()
				}
			},
			update: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.update(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					const modelValue = await this.getModelValue(this.#context, model, key)
					const mergedValue = updateModelValues(value as ModelValue, modelValue ?? {})
					validateModelValue(this.db.models[model], mergedValue)
					this.#context.modelEntries[model][key] = mergedValue
				} finally {
					this.releaseLock()
				}
			},
			merge: async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.merge(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.set(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					const modelValue = await this.getModelValue(this.#context, model, key)
					const mergedValue = mergeModelValues(value as ModelValue, modelValue ?? {})
					validateModelValue(this.db.models[model], mergedValue)
					this.#context.modelEntries[model][key] = mergedValue
				} finally {
					this.releaseLock()
				}
			},
			delete: async (model: string, key: string) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					this.#context.modelEntries[model][key] = null
				} finally {
					this.releaseLock()
				}
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
			while (this.#waiting > 0) {
				await new Promise((resolve) => setTimeout(resolve, 10))
			}
			return result
		} finally {
			this.#context = null
		}
	}
}
