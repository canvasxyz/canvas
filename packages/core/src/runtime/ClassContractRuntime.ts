import { QuickJSHandle } from "quickjs-emscripten"

import { assert, JSValue } from "@canvas-js/utils"

import type { SignerCache } from "@canvas-js/interfaces"
import { ModelValue } from "@canvas-js/modeldb"
import { VM } from "@canvas-js/vm"

import { ModelSchema } from "../types.js"
import { ExecutionContext } from "../ExecutionContext.js"
import { AbstractRuntime } from "./AbstractRuntime.js"

export class ClassContractRuntime extends AbstractRuntime {
	public static async init(
		contract: string,
		args: JSValue[],
		signers: SignerCache,
		options: { runtimeMemoryLimit?: number } = {},
	): Promise<ClassContractRuntime> {
		const { runtimeMemoryLimit } = options

		const vm = await VM.initialize({ runtimeMemoryLimit })

		const contractURI = VM.getFileURI(contract)
		vm.runtime.setModuleLoader((moduleName, context) => {
			if (moduleName === "@canvas-js/core/contract") {
				return `export class Contract {}`
			} else if (moduleName === contractURI) {
				return contract
			} else {
				return { error: new Error(`module "${moduleName}" not found`) }
			}
		})

		using exportsHandle = vm.import(`
		  import Contract from "${contractURI}"
			const createContract = (...args) => new Contract(...args)
			export { Contract, createContract }
		`)

		using contractClassHandle = vm.context.getProp(exportsHandle, "Contract")
		using createContractHandle = vm.context.getProp(exportsHandle, "createContract")

		assert(vm.isClass(contractClassHandle), "invalid contract - expected vm.isClass(contractClassHandle)")
		assert(
			vm.context.typeof(createContractHandle),
			"function",
			"internal error - expected vm.context.typeof(createContractHandle)",
		)

		using contractPrototypeHandle = vm.context.getProp(contractClassHandle, "prototype")
		const actionNames = vm
			.call("Object.getOwnPropertyNames", vm.context.null, [contractPrototypeHandle])
			.consume((handle) => vm.unwrapArray(handle))
			.map((handle) => handle.consume((handle) => vm.context.getString(handle)))
			.filter((name) => name !== "constructor")

		const argHandles = args.map(vm.wrapValue)
		const contractHandle = vm.call(createContractHandle, vm.context.null, argHandles)

		using modelsHandle = vm.context.getProp(contractClassHandle, "models")
		assert(vm.context.typeof(modelsHandle) === "object", "invalid contract class - expected static models object")

		const models = vm.unwrapValue(modelsHandle) as ModelSchema
		assert(
			Object.keys(models).every((key) => !key.startsWith("$")),
			"contract model names cannot start with '$'",
		)

		using topicHandle = vm.context.getProp(contractClassHandle, "topic")
		using nameHandle = vm.context.getProp(contractClassHandle, "name")
		const domain = vm.context.dump(topicHandle)
		const objName = vm.context.dump(nameHandle)
		assert(typeof domain === "string", "invalid contract class - expected `static topic: string`")
		assert(typeof objName === "string", "invalid contract class - expected `name: string`")

		const topic = objName === "default" ? domain : `${domain}.${objName}`

		const actionHandles = Object.fromEntries(
			actionNames.map((actionName) => [
				actionName,
				vm.context.getProp(contractPrototypeHandle, actionName).consume(vm.cache),
			]),
		)

		return new ClassContractRuntime(topic, signers, vm, contract, actionHandles, contractHandle, models)
	}

	readonly #databaseAPI: QuickJSHandle
	readonly #contractHandle: QuickJSHandle

	#context: ExecutionContext | null = null
	#thisHandle: QuickJSHandle | null = null
	#transaction = false
	#txnId = 0

	constructor(
		public readonly topic: string,
		public readonly signers: SignerCache,
		public readonly vm: VM,
		public readonly contract: string,
		public readonly actionHandles: Record<string, QuickJSHandle>,
		contractHandle: QuickJSHandle,
		modelSchema: ModelSchema,
	) {
		super(modelSchema)

		this.actionHandles = actionHandles
		this.contract = contract

		this.#contractHandle = contractHandle

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

			create: vm.wrapFunction(async (model, value) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				await this.context.createModelValue(model, value as ModelValue, this.#transaction)
			}),

			delete: vm.wrapFunction(async (model, key) => {
				assert(typeof model === "string", 'expected typeof model === "string"')
				assert(typeof key === "string", 'expected typeof key === "string"')
				await this.context.deleteModelValue(model, key, this.#transaction)
			}),

			link: vm.wrapFunction(async (modelProperty, source, target) => {
				assert(typeof modelProperty === "string", 'expected typeof modelProperty === "string"')
				assert(typeof source === "string", 'expected typeof source === "string"')
				assert(typeof target === "string", 'expected typeof target === "string"')
				await this.context.linkModelValue(modelProperty, source, target, this.#transaction)
			}),

			unlink: vm.wrapFunction(async (modelProperty, source, target) => {
				assert(typeof modelProperty === "string", 'expected typeof modelProperty === "string"')
				assert(typeof source === "string", 'expected typeof source === "string"')
				assert(typeof target === "string", 'expected typeof target === "string"')
				await this.context.unlinkModelValue(modelProperty, source, target, this.#transaction)
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
				const prng = this.context.prng
				const hi = prng.getUint64().toString(16).padStart(16, "0")
				const lo = prng.getUint64().toString(16).padStart(16, "0")
				return vm.context.newString(hi + lo)
			}),

			random: vm.context.newFunction("random", () => {
				const prng = this.context.prng
				return vm.context.newNumber(prng.getFloat())
			}),
		})

		this.#databaseAPI = databaseAPI.consume(vm.cache)
	}

	public close() {
		this.#contractHandle.dispose()
		this.vm.dispose()
	}

	public getContract() {
		return this.contract
	}

	public get actionNames() {
		return Object.keys(this.actionHandles)
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

		const actionHandle = this.actionHandles[name]
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
			argHandles.forEach((handle: QuickJSHandle) => handle.dispose())
			thisHandle.dispose()
			this.#txnId = 0
			this.#context = null
			this.#thisHandle = null
		}
	}
}
