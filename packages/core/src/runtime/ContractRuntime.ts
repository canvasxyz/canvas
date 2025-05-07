import { QuickJSHandle } from "quickjs-emscripten"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"
import { assert, JSValue, mapEntries, mapValues } from "@canvas-js/utils"

import { hexToBytes, bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"

import { ActionContext, ActionImplementation, Contract, ModelSchema } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"
import { encodeId } from "@canvas-js/gossiplog"
import { generateActionsFromRules } from "./rules.js"

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
			actionHandles = actions?.consume(vm.unwrapObject) ?? null
			modelHandles = models.consume(vm.unwrapObject)
			for (const [key, value] of Object.entries(rest)) {
				console.warn(`extraneous entry "${key}" in contract export`)
				value.dispose()
			}
		} else {
			assert(modelsHandle !== undefined, "missing `models` export")
			actionHandles = actionsHandle?.consume(vm.unwrapObject) ?? null
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
	public readonly actions: Record<string, QuickJSHandle | ActionImplementation>

	readonly #databaseAPI: QuickJSHandle

	#context: ExecutionContext | null = null
	#thisHandle: QuickJSHandle | null = null
	#transaction = false
	#txnId = 0
	#nextId: Uint8Array | null = null

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly vm: VM,
		contract: string,
		modelSchema: ModelSchema,
		actions: Record<string, QuickJSHandle> | null,
	) {
		super(modelSchema)

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this

		this.contract = contract

		// Create a context for generated actions outside the runtime, if
		// we're not using actions inside QuickJS for execution.
		this.actions = actions ?? generateActionsFromRules(this.rules, this.models)

		// mapEntries(generateActionsFromRules(this.rules, this.models), ([name, action]) => {
		// 	const actionHandle = vm.context.newFunction(
		// 		name,
		// 		function (this: QuickJSHandle, ...argHandles: QuickJSHandle[]) {
		// 			const exec = self.#context
		// 			assert(exec !== null, "internal error - expected exec !== null")

		// 			const actionContext: ActionContext<any> = {
		// 				db: {
		// 					id: () => {
		// 						assert(self.#nextId !== null, "internal error - expected self.#nextId !== null")
		// 						self.#nextId = sha256(self.#nextId)
		// 						return bytesToHex(self.#nextId.slice(0, 16))
		// 					},
		// 					get: (model, key) => self.context.getModelValue(model, key, self.#transaction),
		// 					set: (model, value) => self.context.setModelValue(model, value, self.#transaction),
		// 					update: (model, value) => self.context.updateModelValue(model, value, self.#transaction),
		// 					merge: (model, value) => self.context.mergeModelValue(model, value, self.#transaction),
		// 					create: (model, value) => self.context.createModelValue(model, value, self.#transaction),
		// 					delete: (model, key) => self.context.deleteModelValue(model, key, self.#transaction),
		// 					link: (modelProperty, source, target) =>
		// 						self.context.linkModelValue(modelProperty, source, target, self.#transaction),
		// 					unlink: (modelProperty, source, target) =>
		// 						self.context.unlinkModelValue(modelProperty, source, target, self.#transaction),
		// 					transaction: async (callback) => {
		// 						assert(self.#txnId === 0, "transaction(...) can only be used once per action")
		// 						self.#txnId += 1
		// 						self.#transaction = true
		// 						try {
		// 							return await callback()
		// 						} finally {
		// 							self.#transaction = false
		// 						}
		// 					},
		// 				},
		// 				id: exec.id,
		// 				address: exec.address,
		// 				blockhash: exec.message.payload.context.blockhash ?? null,
		// 				timestamp: exec.message.payload.context.timestamp,
		// 				did: exec.did,
		// 				publicKey: exec.publicKey,
		// 			}

		// 			const promise = vm.context.newPromise()
		// 			const args = argHandles.map((arg) => vm.unwrapValue(arg))
		// 			action.apply(actionContext, args).then(
		// 				(result: JSValue) => promise.resolve(vm.wrapValue(result)),
		// 				(err: Error) => promise.reject(vm.wrapError(err)),
		// 			)

		// 			promise.settled.then(vm.runtime.executePendingJobs)
		// 			return promise.handle
		// 		},
		// 	)

		// 	return actionHandle.consume(vm.cache)
		// })

		const databaseAPI = vm.wrapObject({
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
						.then(promise.resolve, (err) => promise.reject(vm.wrapError(err)))
						.finally(() => void (this.#transaction = false))
				} else {
					promise.reject(vm.wrapError(new Error("transaction(...) can only be used once per action")))
				}

				promise.settled.then(vm.runtime.executePendingJobs)
				return promise.handle
			}),

			id: vm.context.newFunction("idgen", () => {
				assert(this.#nextId !== null, "internal error - expected this.#nextId !== null")
				this.#nextId = sha256(this.#nextId)
				return vm.wrapValue(bytesToHex(this.#nextId.slice(0, 16)))
			}),
		})

		this.#databaseAPI = databaseAPI.consume(vm.cache)
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

		if (typeof actionHandle === "function") {
			const actionContext: ActionContext<any> = {
				db: {
					id: () => {
						assert(this.#nextId !== null, "internal error - expected self.#nextId !== null")
						this.#nextId = sha256(this.#nextId)
						return bytesToHex(this.#nextId.slice(0, 16))
					},
					get: (model, key) => exec.getModelValue(model, key, this.#transaction),
					set: (model, value) => exec.setModelValue(model, value, this.#transaction),
					update: (model, value) => exec.updateModelValue(model, value, this.#transaction),
					merge: (model, value) => exec.mergeModelValue(model, value, this.#transaction),
					create: (model, value) => exec.createModelValue(model, value, this.#transaction),
					delete: (model, key) => exec.deleteModelValue(model, key, this.#transaction),
					link: (modelProperty, source, target) =>
						exec.linkModelValue(modelProperty, source, target, this.#transaction),
					unlink: (modelProperty, source, target) =>
						exec.unlinkModelValue(modelProperty, source, target, this.#transaction),
					transaction: async (callback) => {
						assert(this.#txnId === 0, "transaction(...) can only be used once per action")
						this.#txnId += 1
						this.#transaction = true
						try {
							return await callback()
						} finally {
							this.#transaction = false
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

			try {
				this.#txnId = 0
				this.#nextId = encodeId(exec.id)
				this.#context = exec

				return await actionHandle.apply(actionContext, args)
			} finally {
				this.#txnId = 0
				this.#nextId = null
				this.#context = null
			}
		} else {
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
				this.#nextId = encodeId(exec.id)
				this.#context = exec
				this.#thisHandle = thisHandle

				const result = await this.vm.callAsync(actionHandle, thisHandle, argHandles)
				return result.consume((handle) => this.vm.unwrapValue(handle))
			} finally {
				argHandles.forEach((handle: QuickJSHandle) => handle.dispose())
				thisHandle.dispose()
				this.#txnId = 0
				this.#nextId = null
				this.#context = null
				this.#thisHandle = null
			}
		}
	}
}
