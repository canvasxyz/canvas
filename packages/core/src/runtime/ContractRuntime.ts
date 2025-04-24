import { QuickJSHandle } from "quickjs-emscripten"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { assert, JSValue, mapValues } from "@canvas-js/utils"

import { ActionContext, Contract, ModelSchema } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

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

		let actionHandles: Record<string, QuickJSHandle> | null
		let modelHandles: Record<string, QuickJSHandle>
		if (contractHandle !== undefined) {
			assert(actionsHandle === undefined, "cannot export both `contract` and `actions`")
			assert(modelsHandle === undefined, "cannot export both `contract` and `models`")
			const { actions, models, ...rest } = contractHandle.consume(vm.unwrapObject)
			assert(models !== undefined, "missing `models` in contract export")
			actionHandles = actions?.consume(vm.unwrapObject)
			modelHandles = models.consume(vm.unwrapObject)
			for (const [key, value] of Object.entries(rest)) {
				console.warn(`extraneous entry "${key}" in contract export`)
				value.dispose()
			}
		} else {
			assert(modelsHandle !== undefined, "missing `models` export")
			actionHandles = actionsHandle?.consume(vm.unwrapObject)
			modelHandles = modelsHandle.consume(vm.unwrapObject)
		}

		const actions = actionHandles
			? mapValues(actionHandles, (handle) => {
					assert(vm.context.typeof(handle) === "function", "expected action handle to be a function")
					return handle.consume(vm.cache)
				})
			: null

		const modelSchema: ModelSchema = mapValues(modelHandles, (handle) => handle.consume(vm.context.dump))
		assert(
			Object.keys(modelSchema).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		return new ContractRuntime(topic, signers, vm, contract, modelSchema, actions)
	}

	public readonly contract: string
	public readonly actions: Record<string, QuickJSHandle>

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null
	#thisHandle: QuickJSHandle | null = null
	#transaction = false
	#txnId = 0

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly vm: VM,
		contract: string,
		modelSchema: ModelSchema,
		actions: Record<string, QuickJSHandle> | null,
	) {
		super(modelSchema)

		const self = this
		this.contract = contract
		this.actions =
			actions ??
			mapValues(this.generatedActions, (action) => {
				return vm.wrapFunction(async function (this: QuickJSHandle, ...args: JSValue[]) {
					const exec = self.#context
					if (exec === null) throw new Error("expected execution context")

					const actionContext: ActionContext<any> = {
						db: {
							get: async (model, key) => await self.context.getModelValue(model, key, self.#transaction),
							set: async (model, value) => await self.context.setModelValue(model, value, self.#transaction),
							update: async (model, value) => await self.context.updateModelValue(model, value, self.#transaction),
							merge: async (model, value) => await self.context.mergeModelValue(model, value, self.#transaction),
							delete: async (model, key) => await self.context.deleteModelValue(model, key, self.#transaction),
							transaction: async (callbackHandle) => {
								if (self.#txnId === 0) {
									self.#txnId += 1
									self.#transaction = true
									try {
										return callbackHandle.call(actionContext)
									} finally {
										self.#transaction = false
									}
								} else {
									throw new Error("transaction(...) can only be used once per action")
								}
							},
						},
						id: exec.id,
						address: exec.address,
						blockhash: exec.message.payload.context.blockhash ?? null,
						timestamp: exec.message.payload.context.timestamp,
						did: exec.did,
						publicKey: exec.publicKey,
					}

					await action.call(actionContext, ...args)
				})
			})
		this.#databaseAPI = vm
			.wrapObject({
				get: vm.wrapFunction(async (model, key) => {
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					return await this.context.getModelValue(model, key, this.#transaction)
				}),

				set: vm.wrapFunction(async (model, value) => {
					assert(typeof model === "string", 'expected typeof model === "string"')
					await this.context.setModelValue(model, value as ModelValue, this.#transaction)
				}),

				update: vm.wrapFunction(async (model, value) => {
					assert(typeof model === "string", 'expected typeof model === "string"')
					await this.context.updateModelValue(model, value as ModelValue, this.#transaction)
				}),

				merge: vm.wrapFunction(async (model, value) => {
					assert(typeof model === "string", 'expected typeof model === "string"')
					await this.context.mergeModelValue(model, value as ModelValue, this.#transaction)
				}),

				delete: vm.wrapFunction(async (model, key) => {
					assert(typeof model === "string", 'expected typeof model === "string"')
					assert(typeof key === "string", 'expected typeof key === "string"')
					await this.context.deleteModelValue(model, key, this.#transaction)
				}),

				transaction: vm.context.newFunction("transaction", (callbackHandle) => {
					const promise = vm.context.newPromise()
					if (this.#txnId === 0) {
						this.#txnId += 1
						this.#transaction = true
						this.vm
							.callAsync(callbackHandle, this.thisHandle, [])
							.then(promise.resolve, promise.reject)
							.finally(() => void (this.#transaction = false))
					} else {
						promise.reject(vm.wrapError(new Error("transaction(...) can only be used once per action")))
					}

					promise.settled.then(vm.runtime.executePendingJobs)
					return promise.handle
				}),
			})
			.consume(vm.cache)
	}

	public close() {
		this.vm.dispose()
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	private get context() {
		assert(this.#context !== null, "expected this.#context !== null")
		return this.#context
	}

	private get thisHandle() {
		assert(this.#thisHandle !== null, "expected this.#thisHandle !== null")
		return this.#thisHandle
	}

	protected async execute(exec: ExecutionContext): Promise<void | any> {
		const {
			name,
			args,
			context: { blockhash, timestamp },
		} = exec.message.payload

		const actionHandle = this.actions[name]
		if (actionHandle === undefined) {
			throw new Error(`invalid action name: ${name}`)
		}

		const thisHandle = this.vm.wrapValue({
			id: exec.id,
			publicKey: exec.publicKey,
			did: exec.did,
			address: exec.address,
			blockhash: blockhash ?? null,
			timestamp,
		})

		this.vm.context.setProp(thisHandle, "db", this.#databaseAPI)

		const argHandles = Array.isArray(args) ? args.map(this.vm.wrapValue) : [this.vm.wrapValue(args)]

		try {
			this.#txnId = 0
			this.#context = exec
			this.#thisHandle = thisHandle
			const result = await this.vm.callAsync(actionHandle, thisHandle, argHandles)
			return result.consume((handle) => this.vm.unwrapValue(handle))
		} finally {
			argHandles.map((handle: QuickJSHandle) => handle.dispose())
			thisHandle.dispose()
			this.#txnId = 0
			this.#context = null
			this.#thisHandle = null
		}
	}
}
