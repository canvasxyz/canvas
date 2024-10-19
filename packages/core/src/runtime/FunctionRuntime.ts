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
import { assert, mapEntries } from "@canvas-js/utils"

import target from "#target"

import { ActionImplementationFunction, Contract, ModelAPI } from "../types.js"
import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

const identity = (x: any) => x

export class FunctionRuntime<M extends ModelSchema> extends AbstractRuntime {
	public static async init<M extends ModelSchema>(
		topic: string,
		signers: SignerCache,
		contract: Contract<M>,
	): Promise<FunctionRuntime<M>> {
		assert(contract.actions !== undefined, "contract initialized without actions")
		assert(contract.models !== undefined, "contract initialized without models")

		const schema = AbstractRuntime.getModelSchema(contract.models)
		// const db = await target.openDB({ path, topic }, schema)

		const argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		> = {}

		if (contract.globals && Object.keys(contract.globals).length !== 0) {
			throw new Error("cannot initialize FunctionRuntime with globals")
		}

		const actions = mapEntries(contract.actions, ([actionName, action]) => {
			if (typeof action === "function") {
				argsTransformers[actionName] = { toTyped: identity, toRepresentation: identity }
				return action as ActionImplementationFunction<DeriveModelTypes<M>, any>
			}

			if (action.argsType !== undefined) {
				const { schema, name } = action.argsType
				argsTransformers[actionName] = create(fromDSL(schema), name)
			} else {
				argsTransformers[actionName] = { toTyped: identity, toRepresentation: identity }
			}

			return action.apply
		})

		return new FunctionRuntime(topic, signers, schema, actions, argsTransformers)
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
		public readonly actions: Record<string, ActionImplementationFunction<DeriveModelTypes<M>, any>>,
		public readonly argsTransformers: Record<
			string,
			{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
		>,
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

		const argsTransformer = this.argsTransformers[name]
		const action = this.actions[name]
		if (action === undefined || argsTransformer === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const typedArgs = argsTransformer.toTyped(args)
		assert(typedArgs !== undefined, "action args did not validate the provided schema type")

		this.#context = context

		try {
			const result = await action(this.#db, typedArgs, {
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
