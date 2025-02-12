import pDefer, { DeferredPromise } from "p-defer"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelSchema, ModelValue, validateModelValue, DeriveModelTypes } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { ActionContext, ActionImplementation, Contract, ModelAPI, Chainable } from "../types.js"
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
						const {
							primaryKey: [primaryKey],
						} = this.db.models[model]
						const target = isSelect ? (value as string) : ((value as ModelValue)[primaryKey] as string)
						const modelValue = await this.context.getModelValue(linkModel, linkPrimaryKey)
						assert(modelValue !== null, `db.link(): link from a missing model ${linkModel}.get(${linkPrimaryKey})`)
						const backlinkKey = params?.through ?? model
						const backlinkProp = this.db.models[linkModel].properties.find((prop) => prop.name === backlinkKey)
						assert(backlinkProp !== undefined, `db.link(): link from ${linkModel} used missing property ${backlinkKey}`)
						if (backlinkProp.kind === "relation") {
							const current = (modelValue[backlinkKey] ?? []) as string[]
							modelValue[backlinkKey] = current.includes(target) ? current : [...current, target]
						} else {
							throw new Error(`db.link(): link from ${linkModel} ${backlinkKey} must be a relation`)
						}
						if (this.db.models[linkModel] === undefined) throw new Error(`db.link(): no such model "${linkModel}"`)
						validateModelValue(this.db.models[linkModel], modelValue)
						this.context.modelEntries[linkModel][linkPrimaryKey] = modelValue
					} finally {
						this.releaseLock()
					}
				}

				promise.unlink = async (linkModel: string, linkPrimaryKey: string, params?: { through: string }) => {
					await this.acquireLock()
					try {
						const {
							primaryKey: [primaryKey],
						} = this.db.models[model]
						const target = isSelect ? (value as string) : ((value as ModelValue)[primaryKey] as string)
						const modelValue = await this.context.getModelValue(linkModel, linkPrimaryKey)
						assert(modelValue !== null, `db.unlink(): called on a missing model ${linkModel}.get(${linkPrimaryKey})`)
						const backlinkKey = params?.through ?? model
						const backlinkProp = this.db.models[linkModel].properties.find((prop) => prop.name === backlinkKey)
						assert(
							backlinkProp !== undefined,
							`db.unlink(): called on ${linkModel} used missing property ${backlinkKey}`,
						)
						if (backlinkProp.kind === "relation") {
							const current = (modelValue[backlinkKey] ?? []) as string[]
							modelValue[backlinkKey] = current.filter((item) => item !== target)
						} else {
							throw new Error(`db.unlink(): link from ${linkModel} ${backlinkKey} must be a relation`)
						}
						validateModelValue(this.db.models[linkModel], modelValue)
						this.context.modelEntries[linkModel][linkPrimaryKey] = modelValue
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
					const result = await this.context.getModelValue(model, key)
					return result as DeriveModelTypes<ModelsT>[T]
				} finally {
					this.releaseLock()
				}
			},
			select: getChainableMethod(async (model, key: string) => {}, true),
			set: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					this.context.setModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			}),
			create: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					this.context.setModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			}),
			update: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					await this.context.updateModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			}),
			merge: getChainableMethod(async (model, value) => {
				await this.acquireLock()
				try {
					await this.context.mergeModelValue(model, value)
				} finally {
					this.releaseLock()
				}
			}),
			delete: async (model: string, key: string) => {
				await this.acquireLock()
				try {
					this.context.deleteModelValue(model, key)
				} finally {
					this.releaseLock()
				}
			},
			yjsInsert: async (model: string, key: string, index: number, content: string) => {
				this.context.yjsCalls[model] ||= {}
				this.context.yjsCalls[model][key] ||= []
				this.context.yjsCalls[model][key].push({ call: "insert", index, content })
			},
			yjsDelete: async (model: string, key: string, index: number, length: number) => {
				this.context.yjsCalls[model] ||= {}
				this.context.yjsCalls[model][key] ||= []
				this.context.yjsCalls[model][key].push({ call: "delete", index, length })
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
