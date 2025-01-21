import pDefer, { DeferredPromise } from "p-defer"

import type { SignerCache } from "@canvas-js/interfaces"
import {
	ModelSchema,
	ModelValue,
	validateModelValue,
	mergeModelValues,
	updateModelValues,
	DeriveModelTypes,
	RelationValue,
} from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionContext, ActionImplementation, Contract, ModelAPI, Chainable } from "../types.js"
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

		// Extend the return type of set(), merge(), or update() to allow chaining a link() call.
		const getChainableMethod =
			<A extends string, B, ModelTypes extends DeriveModelTypes<ModelsT>>(
				updater: (model: A, value: B) => Promise<void>,
				isSelect?: boolean,
			): ((model: A, value: B) => Chainable<ModelTypes>) =>
			(model, value) => {
				const promise = updater(model, value) as Chainable<ModelTypes>

				// Create a backlink from the model `linkModel` where pk=`linkPrimaryKey`
				// to point at the model we just created or updated.
				promise.link = async (linkModel: string, linkPrimaryKey: string, params?: { through: string }) => {
					await this.acquireLock()
					try {
						assert(this.#context !== null, "expected this.#context !== null")
						const { primaryKey } = this.db.models[model]
						const target = isSelect ? (value as string) : ((value as ModelValue)[primaryKey] as string)
						const modelValue = await this.getModelValue(this.#context, linkModel, linkPrimaryKey)
						assert(modelValue !== null, `db.link(): link from a missing model ${linkModel}.get(${linkPrimaryKey})`)
						const backlinkKey = params?.through ?? model
						const backlinkProp = this.db.models[linkModel].properties.find((prop) => prop.name === backlinkKey)
						assert(backlinkProp !== undefined, `db.link(): link from ${linkModel} used missing property ${backlinkKey}`)
						if (backlinkProp.kind === "relation") {
							const current = (modelValue[backlinkKey] ?? []) as RelationValue
							modelValue[backlinkKey] = current.includes(target) ? current : [...current, target]
						} else {
							throw new Error(`db.link(): link from ${linkModel} ${backlinkKey} must be a relation`)
						}
						validateModelValue(this.db.models[linkModel], modelValue)
						this.#context.modelEntries[linkModel][linkPrimaryKey] = modelValue
					} finally {
						this.releaseLock()
					}
				}

				promise.unlink = async (linkModel: string, linkPrimaryKey: string, params?: { through: string }) => {
					await this.acquireLock()
					try {
						assert(this.#context !== null, "expected this.#context !== null")
						const { primaryKey } = this.db.models[model]
						const target = isSelect ? (value as string) : ((value as ModelValue)[primaryKey] as string)
						const modelValue = await this.getModelValue(this.#context, linkModel, linkPrimaryKey)
						assert(modelValue !== null, `db.unlink(): called on a missing model ${linkModel}.get(${linkPrimaryKey})`)
						const backlinkKey = params?.through ?? model
						const backlinkProp = this.db.models[linkModel].properties.find((prop) => prop.name === backlinkKey)
						assert(
							backlinkProp !== undefined,
							`db.unlink(): called on ${linkModel} used missing property ${backlinkKey}`,
						)
						if (backlinkProp.kind === "relation") {
							const current = (modelValue[backlinkKey] ?? []) as RelationValue
							modelValue[backlinkKey] = current.filter((item) => item !== target)
						} else {
							throw new Error(`db.unlink(): link from ${linkModel} ${backlinkKey} must be a relation`)
						}
						validateModelValue(this.db.models[linkModel], modelValue)
						this.#context.modelEntries[linkModel][linkPrimaryKey] = modelValue
					} finally {
						this.releaseLock()
					}
				}

				return promise
			}

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
			select: getChainableMethod(async (model, key: string) => {}, true),
			set: getChainableMethod(async (model, value) => {
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
			}),
			create: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					validateModelValue(this.db.models[model], value)
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.create(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.create(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					this.#context.modelEntries[model][key] = value
				} finally {
					this.releaseLock()
				}
			}),
			update: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.update(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.update(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					const modelValue = await this.getModelValue(this.#context, model, key)
					if (modelValue === null) {
						console.log(`db.update(${model}, ${key}): attempted to update a nonexistent value`)
						return
					}
					const mergedValue = updateModelValues(value as ModelValue, modelValue ?? {})
					validateModelValue(this.db.models[model], mergedValue)
					this.#context.modelEntries[model][key] = mergedValue
				} finally {
					this.releaseLock()
				}
			}),
			merge: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					const { primaryKey } = this.db.models[model]
					assert(primaryKey in value, `db.merge(${model}): missing primary key ${primaryKey}`)
					assert(primaryKey !== null && primaryKey !== undefined, `db.merge(${model}): ${primaryKey} primary key`)
					const key = (value as ModelValue)[primaryKey] as string
					const modelValue = await this.getModelValue(this.#context, model, key)
					if (modelValue === null) {
						console.log(`db.merge(${model}, ${key}): attempted to merge into a nonexistent value`)
						return
					}
					const mergedValue = mergeModelValues(value as ModelValue, modelValue ?? {})
					validateModelValue(this.db.models[model], mergedValue)
					this.#context.modelEntries[model][key] = mergedValue
				} finally {
					this.releaseLock()
				}
			}),
			delete: async (model: string, key: string) => {
				await this.acquireLock()
				try {
					assert(this.#context !== null, "expected this.#context !== null")
					this.#context.modelEntries[model][key] = null
				} finally {
					this.releaseLock()
				}
			},
			yjsInsert: async (model: string, key: string, index: number, content: string) => {
				assert(this.#context !== null, "expected this.#context !== null")
				if (this.#context.operations[model][key] === undefined) {
					this.#context.operations[model][key] = []
				}
				this.#context.operations[model][key].push({
					type: "yjsInsert",
					index,
					content,
				})
			},
			yjsDelete: async (model: string, key: string, index: number, length: number) => {
				assert(this.#context !== null, "expected this.#context !== null")
				if (this.#context.operations[model][key] === undefined) {
					this.#context.operations[model][key] = []
				}
				this.#context.operations[model][key].push({
					type: "yjsDelete",
					index,
					length,
				})
			},
			yjsFormat: async (
				model: string,
				key: string,
				index: number,
				length: number,
				formattingAttributes: Record<string, string>,
			) => {
				assert(this.#context !== null, "expected this.#context !== null")
				if (this.#context.operations[model][key] === undefined) {
					this.#context.operations[model][key] = []
				}
				this.#context.operations[model][key].push({
					type: "yjsFormat",

					index,
					length,
					formattingAttributes,
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
