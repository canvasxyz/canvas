import { QuickJSHandle } from "quickjs-emscripten"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue, ModelSchema, validateModelValue, updateModelValues, mergeModelValues } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { assert, mapValues } from "@canvas-js/utils"

import { AbstractRuntime, ExecutionContext } from "./AbstractRuntime.js"

export class ContractRuntime extends AbstractRuntime {
	public static async init(
		topic: string,
		signers: SignerCache,
		contract: string,
		options: { runtimeMemoryLimit?: number } = {},
	): Promise<ContractRuntime> {
		const { runtimeMemoryLimit } = options

		const vm = await VM.initialize({ runtimeMemoryLimit })

		const {
			contract: contractHandle,
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = vm.import(contract).consume(vm.unwrapObject)

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		let actionHandles: Record<string, QuickJSHandle>
		let modelHandles: Record<string, QuickJSHandle>
		if (contractHandle !== undefined) {
			assert(actionsHandle === undefined, "cannot export both `contract` and `actions`")
			assert(modelsHandle === undefined, "cannot export both `contract` and `models`")
			const { actions, models, ...rest } = contractHandle.consume(vm.unwrapObject)
			assert(actions !== undefined, "missing `actions` in contract export")
			assert(models !== undefined, "missing `models` in contract export")
			actionHandles = actions.consume(vm.unwrapObject)
			modelHandles = models.consume(vm.unwrapObject)
			for (const [key, value] of Object.entries(rest)) {
				console.warn(`extraneous entry "${key}" in contract export`)
				value.dispose()
			}
		} else {
			assert(actionsHandle !== undefined, "missing `actions` export")
			assert(modelsHandle !== undefined, "missing `models` export")
			actionHandles = actionsHandle.consume(vm.unwrapObject)
			modelHandles = modelsHandle.consume(vm.unwrapObject)
		}

		const actions = mapValues(actionHandles, (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action handle to be a function")
			return handle.consume(vm.cache)
		})

		// TODO: Validate that models satisfies ModelSchema
		const mergeHandles: Record<string, QuickJSHandle> = {}

		const modelSchema: ModelSchema = mapValues(modelHandles, (handle) => handle.consume(vm.context.dump))
		assert(
			Object.keys(modelSchema).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		const cleanupSetupHandles = () => {
			for (const handle of Object.values(mergeHandles)) {
				handle.dispose()
			}
		}

		const schema = AbstractRuntime.getModelSchema(modelSchema)
		return new ContractRuntime(topic, signers, schema, vm, actions, cleanupSetupHandles)
	}

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly schema: ModelSchema,
		public readonly vm: VM,
		public readonly actions: Record<string, QuickJSHandle>,
		private disposeSetupHandles: () => void,
	) {
		super()
		this.#databaseAPI = vm
			.wrapObject({
				get: vm.wrapFunction((model, key) => {
					assert(this.#context !== null, "expected this.#context !== null")
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					return this.#context.getModelValue(model, key)
				}),
				set: vm.context.newFunction("set", (modelHandle, valueHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					validateModelValue(this.db.models[model], value)
					const {
						primaryKey: [primaryKey],
					} = this.db.models[model]
					const key = value[primaryKey] as string
					assert(typeof key === "string", "expected value[primaryKey] to be a string")
					this.#context.modelEntries[model][key] = value
				}),
				create: vm.context.newFunction("create", (modelHandle, valueHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					validateModelValue(this.db.models[model], value)
					const {
						primaryKey: [primaryKey],
					} = this.db.models[model]
					const key = value[primaryKey] as string
					assert(typeof key === "string", "expected value[primaryKey] to be a string")
					this.#context.modelEntries[model][key] = value
				}),
				update: vm.context.newFunction("update", (modelHandle, valueHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const {
						primaryKey: [primaryKey],
					} = this.db.models[model]
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					const key = value[primaryKey] as string
					assert(typeof key === "string", "expected value[primaryKey] to be a string")
					const promise = vm.context.newPromise()
					// TODO: Ensure concurrent merges into the same value don't create a race condition
					// if the user doesn't call db.update() with await.
					this.#context
						.getModelValue(model, key)
						.then((previousValue) => {
							const mergedValue = updateModelValues(value, previousValue ?? {})
							validateModelValue(this.db.models[model], mergedValue)
							assert(this.#context !== null)
							this.#context.modelEntries[model][key] = mergedValue
							promise.resolve()
						})
						.catch((err) => {
							promise.reject()
						})
					promise.settled.then(vm.runtime.executePendingJobs)
					return promise.handle
				}),
				merge: vm.context.newFunction("merge", (modelHandle, valueHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const {
						primaryKey: [primaryKey],
					} = this.db.models[model]
					const value = this.vm.unwrapValue(valueHandle) as ModelValue
					const key = value[primaryKey] as string
					assert(typeof key === "string", "expected value[primaryKey] to be a string")
					const promise = vm.context.newPromise()
					// TODO: Ensure concurrent merges into the same value don't create a race condition
					// if the user doesn't call db.merge() with await.
					this.#context
						.getModelValue(model, key)
						.then((previousValue) => {
							const mergedValue = mergeModelValues(value, previousValue ?? {})
							validateModelValue(this.db.models[model], mergedValue)
							assert(this.#context !== null)
							this.#context.modelEntries[model][key] = mergedValue
							promise.resolve()
						})
						.catch((err) => {
							promise.reject()
						})
					promise.settled.then(vm.runtime.executePendingJobs)
					return promise.handle
				}),

				delete: vm.context.newFunction("delete", (modelHandle, keyHandle) => {
					assert(this.#context !== null, "expected this.#modelEntries !== null")
					const model = vm.context.getString(modelHandle)
					assert(this.db.models[model] !== undefined, "model not found")
					const key = vm.context.getString(keyHandle)
					this.#context.modelEntries[model][key] = null
				}),
			})
			.consume(vm.cache)
	}

	public close() {
		this.disposeSetupHandles()
		this.vm.dispose()
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

		const actionHandle = this.actions[name]

		if (actionHandle === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		this.#context = context

		const ctxHandle = this.vm.wrapValue({
			id: context.id,
			publicKey,
			did,
			address,
			blockhash: blockhash ?? null,
			timestamp,
		})

		const argHandles = Array.isArray(args) ? args.map(this.vm.wrapValue) : [this.vm.wrapValue(args)]

		try {
			const result = await this.vm.callAsync(actionHandle, ctxHandle, [this.#databaseAPI, ...argHandles])

			return result.consume((handle) => {
				if (this.vm.context.typeof(handle) === "undefined") {
					return undefined
				} else {
					return this.vm.unwrapValue(result)
				}
			})
		} finally {
			argHandles.map((handle: QuickJSHandle) => handle.dispose())
			ctxHandle.dispose()
			this.#context = null
		}
	}
}
